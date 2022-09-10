
import { VectorData } from 'lib/core';
import { NPC } from 'lib/core/entities/NPC';
import { Player } from 'lib/core/entities/Player';
import * as app from '.';

export class Aimbot {


  update(buttonList: app.core.ButtonList, localPlayer?: app.core.Player, players?: Iterable<Player>, npcs?: Iterable<NPC>) {
    if (!localPlayer) return;
    if (!players) return;
    if (!npcs) return;

    const enemyBasicInfo = this.createEnemyBasicInfo(localPlayer, players, npcs);
    if (enemyBasicInfo.length == 0) return;
    const closestEnemyBasicInfo = this.findClosestEnemyBasicInfo(enemyBasicInfo);
    console.log(closestEnemyBasicInfo.viewAngleToPlayer.yaw)

    // if (closestEnemyBasicInfo.crosshairsDistance > 10) return;
    if (!buttonList.inAttack.value) return;

    //make sure we don't make rapid skips by more than 10 degrees
    // if (localPlayer.viewAngle.value.x - closestEnemyBasicInfo.viewAngleToPlayer.pitch > 10) return;
    // if (localPlayer.viewAngle.value.y - closestEnemyBasicInfo.viewAngleToPlayer.yaw > 10) return;


    if (closestEnemyBasicInfo.viewAngleToPlayer.yaw > 10) return;

    localPlayer.viewAngle.value = new VectorData(closestEnemyBasicInfo.viewAngleToPlayer.pitch, closestEnemyBasicInfo.viewAngleToPlayer.yaw, 0);
  }

  createNewViewingAnglesStats(localPlayer: Player, closestEnemyPlayer: Player, smoothingDivisor: number): ViewAnglesStats {
    const newViewingAngles: ViewingAngles = this.calculateViewAngles(localPlayer, closestEnemyPlayer);
    const currentYaw: number = localPlayer.viewAngle.value.y;
    const desiredYaw: number = newViewingAngles.yaw;
    const yawDelta: number = this.calcYawDeltaAndFlipIfNeeded(currentYaw, desiredYaw);
    const yawDeltaAbs: number = Math.abs(yawDelta);
    const yawDeltaSmoothed: number = yawDelta / smoothingDivisor;
    const flipYaw: boolean = localPlayer.localOrigin.value.y < closestEnemyPlayer.localOrigin.value.y;
    const currentPitch: number = localPlayer.viewAngle.value.x;
    const desiredPitch: number = newViewingAngles.pitch;
    const pitchDelta: number = currentPitch - desiredPitch;
    const pitchDeltaAbs: number = Math.abs(pitchDelta);
    const pitchDeltaSmoothed: number = pitchDelta / smoothingDivisor;
    return {
      currentYaw: currentYaw,
      desiredYaw: desiredYaw,
      yawDelta: yawDelta,
      yawDeltaAbs: yawDeltaAbs,
      yawDeltaSmoothed: yawDeltaSmoothed,
      flipYaw: flipYaw,
      currentPitch: currentPitch,
      desiredPitch: desiredPitch,
      pitchDelta: pitchDelta,
      pitchDeltaAbs: pitchDeltaAbs,
      pitchDeltaSmoothed: pitchDeltaSmoothed,
    }
  }

  calcYawDeltaAndFlipIfNeeded(currentYaw: number, desiredYaw: number) {
    let delta = currentYaw - desiredYaw;
    if (Math.abs(delta) > 180) {
      if (currentYaw > 0 && desiredYaw < 0)
        delta -= 360;
      if (currentYaw < 0 && desiredYaw > 0) {
        delta = 180 - Math.abs(currentYaw) + 180 - Math.abs(desiredYaw);
      }
    }
    return delta;
  }

  calculateViewAngles(localPlayer: Player, enemyPlayer: Player | NPC): ViewingAngles {
    const locationDeltaX: number = enemyPlayer.localOrigin.value.x - localPlayer.localOrigin.value.x;
    const locationDeltaY: number = enemyPlayer.localOrigin.value.y - localPlayer.localOrigin.value.y;
    const locationDeltaZ: number = enemyPlayer.localOrigin.value.z - localPlayer.localOrigin.value.z;
    const hypotenus = Math.sqrt(Math.pow(Math.abs(locationDeltaX), 2) + Math.pow(Math.abs(locationDeltaY), 2));

    const yawInRadians = Math.atan2(locationDeltaY, locationDeltaX);
    const yawInDegrees = yawInRadians * (180 / Math.PI);
    let roundedYaw = Number(yawInDegrees.toFixed(9));
    if (roundedYaw > 180) roundedYaw = 180.00;
    if (roundedYaw < -180) roundedYaw = -180.00;

    const pitchInRadians = Math.atan(locationDeltaZ / -hypotenus);
    const pitchInDegrees: number = pitchInRadians * (180 / Math.PI);
    let roundedPitch = Number(pitchInDegrees.toFixed(9));
    if (roundedPitch > 90) roundedPitch = 90.00;
    if (roundedPitch < -90) roundedPitch = -90.00;

    return { pitch: roundedPitch, yaw: roundedYaw };
  }

  findClosestEnemyPlayer(localPlayer: Player, players: Array<Player>): Player | null {
    const enemyPlayers = players.filter(p => { return !p.isSameTeam(localPlayer) && !p.bleedoutState.value });
    if (enemyPlayers.length == 0)
      return null;
    let closesTargetSoFar: Player = enemyPlayers[0];
    let closesTargetSoFarDistance = this.calculateViewAngles(localPlayer, closesTargetSoFar);
    for (let i: number = 1; i < enemyPlayers.length; i++) {
      const currEP = enemyPlayers[i];
      const currEPDistance = this.calculateViewAngles(localPlayer, currEP);
      if (currEPDistance < closesTargetSoFarDistance) {
        closesTargetSoFar = currEP;
        closesTargetSoFarDistance = currEPDistance;
      }
    }
    return closesTargetSoFar;
  }

  calcDistance(playerA: Player, playerB: Player) {
    const dx: number = playerA.localOrigin.value.x - playerB.localOrigin.value.x;
    const dy: number = playerA.localOrigin.value.y - playerB.localOrigin.value.y;
    const dz: number = playerA.localOrigin.value.z - playerB.localOrigin.value.z;
    const distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2));
    return distance;
  }

  createEnemyBasicInfo(localPlayer: app.core.Player, players: Iterable<app.core.Player>, npcs: Iterable<app.core.NPC>): PlayerToViewAngleEntry[] {
    const playerViewAngleInfo: PlayerToViewAngleEntry[] = [];
    for (const enemy of players) {
      if (!enemy.isValid) continue;
      if (enemy.isSameTeam(localPlayer)) continue;
      const viewAnglesToPlayer: ViewingAngles = this.calculateViewAngles(localPlayer, enemy);
      playerViewAngleInfo.push({
        enemy: enemy,
        viewAngleToPlayer: viewAnglesToPlayer,
        crosshairsDistance: Math.abs(viewAnglesToPlayer.yaw)
      });
    }
    for (const enemy of npcs) {
      const viewAnglesToPlayer: ViewingAngles = this.calculateViewAngles(localPlayer, enemy);
      playerViewAngleInfo.push({
        enemy: enemy,
        viewAngleToPlayer: viewAnglesToPlayer,
        crosshairsDistance: Math.abs(viewAnglesToPlayer.yaw)
      });
    }
    return playerViewAngleInfo;
  }

  findClosestEnemyBasicInfo(playerToViewAngles: PlayerToViewAngleEntry[]) {
    let smallestEnemy = playerToViewAngles[0];
    for (let i = 1; i < playerToViewAngles.length; i++) {
      const currentEnemy = playerToViewAngles[i];
      if (currentEnemy.crosshairsDistance < smallestEnemy.crosshairsDistance)
        smallestEnemy = currentEnemy;
    }
    return smallestEnemy;
  }

}

interface ViewingAngles {
  yaw: number;
  pitch: number;
}

interface ViewAnglesStats {
  currentYaw: number;
  desiredYaw: number;
  yawDelta: number;
  yawDeltaAbs: number;
  yawDeltaSmoothed: number;
  flipYaw: boolean;
  currentPitch: number;
  desiredPitch: number;
  pitchDelta: number;
  pitchDeltaAbs: number;
  pitchDeltaSmoothed: number;
}

interface PlayerToViewAngleEntry {
  enemy: Player | NPC;
  viewAngleToPlayer: ViewingAngles;
  crosshairsDistance: number;
}