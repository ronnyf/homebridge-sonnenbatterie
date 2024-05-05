// eslint-disable-next-line max-len
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { SonnenAPI } from './sonnenApi';
import { AccessoryType, SonnenAccessoryFactory, UpdatableAccessory } from './sonnenAccessory';
import { SonnenMQTT } from './sonnenMQTT';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SonnenHomebridgePlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly sonnenAPI: SonnenAPI;
  public readonly sonnenMQTT: SonnenMQTT;
  private updatableAccessories: UpdatableAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.log.debug('Finished initializing platform:', config.name);
    this.sonnenAPI = new SonnenAPI(2, 1, config, log);
    this.sonnenMQTT = new SonnenMQTT(config, log);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('discovering devices');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This method is used to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */

  async discoverDevices() {
    this.log.info('discovering SonnenBatterie');

    const config = await this.sonnenAPI.fetchConfiguration();
    this.log.debug(`config: ${JSON.stringify(config)}`);
    this.log.info(`Cap: ${config.CM_MarketingModuleCapacity}`);
    this.log.info(`Role: ${config.CN_CascadingRole}`);
    this.log.info(`SW: ${config.DE_Software}`);

    await this.sonnenAPI.reloadBatteryStatus();
    this.log.debug(`status: ${JSON.stringify(this.sonnenAPI.batteryStatus)}`);

    const factory = new SonnenAccessoryFactory(this, this.api, this.sonnenMQTT, this.log);

    // TODO: enumerate something to make this less hard-coded
    this.registerAccessory(factory, AccessoryType.Production);
    this.registerAccessory(factory, AccessoryType.Consumption);
    this.registerAccessory(factory, AccessoryType.Grid);

    setInterval(() => {
      try {
        this.fetchSonnenStatus();
      } catch (error) {
        this.log.error(`Error fetching latestData from SonnenAPI: ${error}`);
      }
    }, 10000);
  }

  async registerAccessory(
    factory: SonnenAccessoryFactory,
    displayName: string,
  ) {
    const uuid = this.api.hap.uuid.generate(displayName);
    const existingAccessory = this.accessories.find((accessory) => {
      return accessory.UUID === uuid;
    });

    let updatable: UpdatableAccessory | null;
    if (existingAccessory) {
      updatable = factory.registerPlugin(existingAccessory);
    } else {
      updatable = factory.makePlugin(displayName, uuid);
    }

    if (updatable !== null) {
      this.updatableAccessories.push(updatable);
    }
  }

  updateAccessories() {
    this.updatableAccessories.forEach((updatable) => {
      updatable.updateAccessory(this.sonnenAPI.batteryStatus, this.sonnenAPI.inverterStatus);
    });
  }

  async fetchSonnenStatus() {
    await this.sonnenAPI.reloadBatteryStatus();
    this.log.info(`did fetch battery status: ${JSON.stringify(this.sonnenAPI.batteryStatus)}`);

    await this.sonnenAPI.reloadInverterStatus();
    this.log.info(`did fetch inverter status: ${JSON.stringify(this.sonnenAPI.inverterStatus)}`);

    // updating post fetch
    this.updateAccessories();
  }

  async getStatusValue<T>(value: T): Promise<T> {
    this.log.debug('returning status value ->', value);
    return value;
  }

  // battery status bindables
  // async getBatteryLevel(): Promise<CharacteristicValue> {
  //   const battery = this.batteryStatus.Level;
  //   this.log.debug('Get Characteristic BatteryLevel ->', battery);
  //   return battery;
  // }

  // async getBatteryLowChargeState(): Promise<CharacteristicValue> {
  //   const lowBatteryStatus = this.batteryStatus.Level > this.batteryStatus.Backup
  //     ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
  //     : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
  //   this.log.debug('Get Characteristic LowBattery ->', lowBatteryStatus);
  //   return lowBatteryStatus;
  // }

  // async getProduction(): Promise<CharacteristicValue> {
  //   const production = this.batteryStatus.Production;
  //   this.log.debug('Get Characteristic Production ->', production);
  //   return production;
  // }

  // async getProductionOn(): Promise<CharacteristicValue> {
  //   const productionOn = this.batteryStatus.Production > 0 ?? false;
  //   this.log.debug('Get Characteristic ProductionOn ->', productionOn);
  //   return productionOn;
  // }
}
