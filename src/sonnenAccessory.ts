import { API, Logger, PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SonnenHomebridgePlatform } from './platform';
import { SonnenBatterieProductionAccessory } from './sonnenProductionAccessory';
import { BatteryStatus, InverterStatus } from './sonnenApi';
import { SonnenMQTT } from './sonnenMQTT';
import { SonnenBatterieConsumptionAccessory } from './sonnenConsumptionAccessory';
import { SonnenBatterieGridAccessory } from './sonnenGridAccessory';

export interface UpdatableAccessory {
  updateAccessory(batteryStatus: BatteryStatus, inverterStatus: InverterStatus): void;
}

export const AccessoryType = {
  Production: 'production',
  Consumption: 'consumption',
  Grid: 'grid',
};

export class SonnenAccessoryFactory {

  private platform: SonnenHomebridgePlatform;
  private api: API;
  private mqtt: SonnenMQTT;
  private log: Logger;

  constructor(platform: SonnenHomebridgePlatform, api: API, mqtt: SonnenMQTT, log: Logger) {
    this.platform = platform;
    this.api = api;
    this.mqtt = mqtt
    this.log = log;
  }

  makePlugin(displayName: string, uuid: string): UpdatableAccessory | null {
    // the accessory does not yet exist, so we need to create it
    this.log.debug(`Adding new accessory: ${displayName} (${uuid})`);

    // create a new accessory
    const accessory = new this.api.platformAccessory(displayName, uuid);

    let updatable: UpdatableAccessory | null;
    switch (displayName) {
      case AccessoryType.Production:
        updatable = new SonnenBatterieProductionAccessory(this.platform, accessory);
        break;

      case AccessoryType.Consumption:
        updatable = new SonnenBatterieConsumptionAccessory(this.platform, accessory);
        break;

      case AccessoryType.Grid:
        updatable = new SonnenBatterieGridAccessory(this.platform, accessory);
        break;

      default:
        updatable = null;
        break;
    }

    // link the accessory to your platform
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    return updatable;
  }

  registerPlugin<P extends PlatformAccessory>(existingAccessory: P): UpdatableAccessory | null {
    // the accessory already exists
    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

    // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
    this.api.updatePlatformAccessories([existingAccessory]);

    // create the accessory handler for the restored accessory
    // this is imported from `platformAccessory.ts`
    this.log.debug(`creating accessory handler for restored accessory: ${existingAccessory.UUID}, ${existingAccessory.displayName}`);

    // FIXME: looks like this is replicated code - let's put this into a function
    let updatable: UpdatableAccessory | null;
    switch (existingAccessory.displayName) {
      case AccessoryType.Production:
        updatable = new SonnenBatterieProductionAccessory(this.platform, existingAccessory);
        break;

      case AccessoryType.Consumption:
        updatable = new SonnenBatterieConsumptionAccessory(this.platform, existingAccessory);
        break;

      case AccessoryType.Grid:
        updatable = new SonnenBatterieGridAccessory(this.platform, existingAccessory);
        break;

      default:
        updatable = null;
        break;
    }

    return updatable;
    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // remove platform accessories when no longer present
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
  }
}