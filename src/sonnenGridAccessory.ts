import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SonnenHomebridgePlatform } from './platform';
import { UpdatableAccessory } from './sonnenAccessory';
import { BatteryStatus, InverterStatus } from './sonnenApi';

export class SonnenBatterieGridAccessory<P extends PlatformAccessory> implements UpdatableAccessory {

  private service: Service;

  constructor(
    private readonly platform: SonnenHomebridgePlatform,
    private readonly accessory: P
  ) {
    // set accessory information
    accessory.getService(platform.Service.AccessoryInformation)!
      .setCharacteristic(platform.Characteristic.Manufacturer, 'RFx Labs')
      .setCharacteristic(platform.Characteristic.Model, 'Grid-V1')
      .setCharacteristic(platform.Characteristic.SerialNumber, 'GRID-V1');

    const gridService = accessory.getService('SB-Grid-ID')
      || accessory.addService(platform.Service.Switch, 'Grid Import', 'SB-Grid-ID');

    gridService.addOptionalCharacteristic(platform.Characteristic.BatteryLevel);
    gridService.addOptionalCharacteristic(platform.Characteristic.StatusLowBattery);
    gridService.addOptionalCharacteristic(platform.Characteristic.StatusActive);
    gridService.addOptionalCharacteristic(platform.Characteristic.StatusFault);

    gridService.getCharacteristic(platform.Characteristic.On)
      .onGet(this.isImporting.bind(this));

    gridService.getCharacteristic(platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    gridService.getCharacteristic(platform.Characteristic.StatusLowBattery)
      .onGet(this.hasLowBattery.bind(this));

    gridService.getCharacteristic(platform.Characteristic.StatusActive)
      .onGet(this.isImporting.bind(this));

    this.platform.log.debug('did bind characteristics to service: ', gridService.UUID);

    this.service = gridService;
  }

  async isImporting(): Promise<CharacteristicValue> { 
    const value = this.platform.sonnenAPI.batteryStatus.GridFeedIn_W <= 0;
    return value
  }

  async isExporting(): Promise<CharacteristicValue> { 
    const value = this.platform.sonnenAPI.batteryStatus.GridFeedIn_W > 0;
    return value
  }

  async getGridFeedIn(): Promise<CharacteristicValue> {
    const value = this.platform.sonnenAPI.batteryStatus.GridFeedIn_W;
    return value;
  }

  async getBatteryLevel(): Promise<CharacteristicValue> {
    const value = this.platform.sonnenAPI.batteryStatus.USOC;
    return value;
  }

  async hasLowBattery(): Promise<CharacteristicValue> {
    const value = this.platform.sonnenAPI.batteryStatus.USOC <= this.platform.sonnenAPI.batteryStatus.BackupBuffer;
    return value;
  }

  // Updatable Accessory

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateAccessory(batteryStatus: BatteryStatus, inverterStatus: InverterStatus) {
    this.platform.log.debug('updating grid accessory');
    const isFeedingIntoGrid = batteryStatus.GridFeedIn_W > 0;
    const level = batteryStatus.USOC;
    const lowBattery = level < batteryStatus.BackupBuffer;

    this.platform.sonnenMQTT.update(batteryStatus.GridFeedIn_W * -1, "Grid");
    this.platform.sonnenMQTT.update(batteryStatus.USOC, "USOC");
    this.platform.sonnenMQTT.update(batteryStatus.RSOC, "RSOC");

    this.service.updateCharacteristic(this.platform.Characteristic.On, isFeedingIntoGrid);
    this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, level);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBattery);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, isFeedingIntoGrid);
  }
}