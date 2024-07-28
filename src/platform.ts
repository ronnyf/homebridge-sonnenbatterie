import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge";
import { SonnenAPI } from "./sonnenApi";
import {
  AccessoryType,
  SonnenAccessoryFactory,
  UpdatableAccessory,
} from "./sonnenAccessory";
import { SonnenMQTT } from "./garageclient";

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
  public readonly sonnenMqtt: SonnenMQTT;
  private updatableAccessories: UpdatableAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug("Finished initializing platform:", config.name);

    this.sonnenAPI = new SonnenAPI(2, 1, config, log);
    const mqttRootTopic = this.config['mqttRootTopic'] ?? 'Sonnen';
    this.sonnenMqtt = new SonnenMQTT(null, mqttRootTopic);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", () => {
      log.debug("discovering devices");
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      this.mqttConnect();
      this.registerAccessories()
      this.runloop();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This method is used to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */

  async discoverDevices(): Promise<void> {
    this.log.info("discovering SonnenBatterie");

    const config = await this.sonnenAPI.fetchConfiguration();
    this.log.debug(`config: ${JSON.stringify(config)}`);
    this.log.info(`Cap: ${config.CM_MarketingModuleCapacity}`);
    this.log.info(`Role: ${config.CN_CascadingRole}`);
    this.log.info(`SW: ${config.DE_Software}`);

    await this.sonnenAPI.reloadBatteryStatus();
    this.log.debug(`1st status: ${JSON.stringify(this.sonnenAPI.batteryStatus)}`);
  }

  async mqttConnect(): Promise<void> {
    this.log.info("connecting to mqtt broker");

    const clientID = this.config['mqttClientID'] ?? 'SonnenMQTT';
    const username = this.config['mqttUser'];
    const password = this.config['mqttPassword'];

    if (username == null) {
      this.log.warn("username is null")
    }
    if (password == null) { 
      this.log.warn("password is null")
    }

    const host = this.config['mqttHost'] ?? 'mqtt://localhost:1883';

    await this.sonnenMqtt.connectAsync(clientID, username, password, host);
    this.log.debug("did connect to mqtt broker");
  }

  runloop() {
    const interval: number = this.config["refreshInterval"] ?? 30;
    setInterval(() => {
      try {
        this.fetchSonnenStatus();
      } catch (error) {
        this.log.error(`Error fetching latestData from SonnenAPI: ${error}`);
      }
    }, interval * 1000);
  }

  registerAccessories() {
    const factory = new SonnenAccessoryFactory(this);

    this.registerAccessory(factory, AccessoryType.Production);
    this.registerAccessory(factory, AccessoryType.Consumption);
    this.registerAccessory(factory, AccessoryType.Grid);
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
      updatable.updateAccessory(
        this.sonnenAPI.batteryStatus,
        this.sonnenAPI.inverterStatus,
      );
    });
  }

  async fetchSonnenStatus() {
    await this.sonnenAPI.reloadBatteryStatus();
    // this.log.debug(`did fetch battery status: ${JSON.stringify(this.sonnenAPI.batteryStatus)}`);

    await this.sonnenAPI.reloadInverterStatus();
    // this.log.debug(`did fetch inverter status: ${JSON.stringify(this.sonnenAPI.inverterStatus)}`);

    // updating post fetch
    this.updateAccessories();
  }
}
