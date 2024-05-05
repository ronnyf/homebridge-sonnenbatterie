import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SonnenHomebridgePlatform } from './platform';
import { UpdatableAccessory } from './sonnenAccessory';
import { BatteryStatus, InverterStatus } from './sonnenApi';

export class SonnenBatterieProductionAccessory<P extends PlatformAccessory> implements UpdatableAccessory {

  private service: Service;

  constructor(
    private readonly platform: SonnenHomebridgePlatform,
    private readonly accessory: P
  ) {
    // set accessory information
    accessory.getService(platform.Service.AccessoryInformation)!
      .setCharacteristic(platform.Characteristic.Manufacturer, 'RFx Labs')
      .setCharacteristic(platform.Characteristic.Model, 'Production-V1')
      .setCharacteristic(platform.Characteristic.SerialNumber, 'PRD-V1');

    const productionService = accessory.getService('SB-Prd-ID')
      || accessory.addService(platform.Service.Switch, 'Production', 'SB-Prd-ID');

    productionService.setPrimaryService(true);

    productionService.addOptionalCharacteristic(platform.Characteristic.BatteryLevel);
    productionService.addOptionalCharacteristic(platform.Characteristic.StatusLowBattery);
    productionService.addOptionalCharacteristic(platform.Characteristic.StatusActive);
    productionService.addOptionalCharacteristic(platform.Characteristic.StatusFault);

    productionService.getCharacteristic(platform.Characteristic.On)
      .onGet(this.hasProduction.bind(this));

    productionService.getCharacteristic(platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    productionService.getCharacteristic(platform.Characteristic.StatusLowBattery)
      .onGet(this.hasLowBattery.bind(this));

    productionService.getCharacteristic(platform.Characteristic.StatusActive)
      .onGet(this.hasProduction.bind(this));

    this.platform.log.debug('did bind characteristics to service: ', productionService.UUID);

    this.service = productionService;
  }

  async hasProduction(): Promise<CharacteristicValue> { 
    const value = this.platform.sonnenAPI.batteryStatus.Production_W > 0;
    return value
  }

  async getProduction(): Promise<CharacteristicValue> {
    const value = this.platform.sonnenAPI.batteryStatus.Production_W;
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
    this.platform.log.debug('updating production accessory');
    const hasProduction = batteryStatus.Production_W > 0;
    const level = batteryStatus.USOC;
    const lowBattery = level < batteryStatus.BackupBuffer;

    this.platform.sonnenMQTT.update(batteryStatus.Production_W, "Production");
    this.platform.sonnenMQTT.update(batteryStatus.USOC, "USOC");
    this.platform.sonnenMQTT.update(batteryStatus.RSOC, "RSOC");

    this.service.updateCharacteristic(this.platform.Characteristic.On, hasProduction);
    this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, level);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBattery);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, hasProduction);
  }
}