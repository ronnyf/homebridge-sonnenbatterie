import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SonnenHomebridgePlatform } from './platform';
import { UpdatableAccessory } from './sonnenAccessory';
import { BatteryStatus, InverterStatus } from './sonnenApi';

export class SonnenBatterieConsumptionAccessory<P extends PlatformAccessory> implements UpdatableAccessory {

  private service: Service;

  constructor(
    private readonly platform: SonnenHomebridgePlatform,
    private readonly accessory: P
  ) {
    // set accessory information
    accessory.getService(platform.Service.AccessoryInformation)!
      .setCharacteristic(platform.Characteristic.Manufacturer, 'RFx Labs')
      .setCharacteristic(platform.Characteristic.Model, 'Consumption-V1')
      .setCharacteristic(platform.Characteristic.SerialNumber, 'CONS-V1');

    const consumptionService = accessory.getService('SB-Cons-ID')
      || accessory.addService(platform.Service.Switch, 'Consumption', 'SB-Cons-ID');

    consumptionService.setPrimaryService(true);

    consumptionService.addOptionalCharacteristic(platform.Characteristic.BatteryLevel);
    consumptionService.addOptionalCharacteristic(platform.Characteristic.StatusLowBattery);
    consumptionService.addOptionalCharacteristic(platform.Characteristic.StatusActive);
    consumptionService.addOptionalCharacteristic(platform.Characteristic.StatusFault);

    consumptionService.getCharacteristic(platform.Characteristic.On)
      .onGet(this.hasConsumption.bind(this));

    consumptionService.getCharacteristic(platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    consumptionService.getCharacteristic(platform.Characteristic.StatusLowBattery)
      .onGet(this.hasLowBattery.bind(this));

    consumptionService.getCharacteristic(platform.Characteristic.StatusActive)
      .onGet(this.hasConsumption.bind(this));

    this.platform.log.debug('did bind characteristics to service: ', consumptionService.UUID);

    this.service = consumptionService;
  }

  async hasConsumption(): Promise<CharacteristicValue> { 
    const value = this.platform.sonnenAPI.batteryStatus.Consumption_W > 0;
    return value
  }

  async getConsumption(): Promise<CharacteristicValue> {
    const value = this.platform.sonnenAPI.batteryStatus.Consumption_W;
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
    this.platform.log.debug('updating consumption accessory');
    const hasConsumption = batteryStatus.Consumption_W > 0;
    const level = batteryStatus.USOC;
    const lowBattery = level < batteryStatus.BackupBuffer;

    this.platform.sonnenMQTT.update(batteryStatus.Consumption_W, "Consumption");
    this.platform.sonnenMQTT.update(batteryStatus.USOC, "USOC");

    //Grid (+I/-E) MQTT topic to modulate charge rate based on excess power
    this.platform.sonnenMQTT.update(batteryStatus.GridFeedIn_W * -1, "Grid"); 

    this.service.updateCharacteristic(this.platform.Characteristic.On, hasConsumption);
    this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, level);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBattery);
    this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, hasConsumption);
  }
}