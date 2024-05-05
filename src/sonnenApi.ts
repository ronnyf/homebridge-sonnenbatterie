import axios, { AxiosResponse } from "axios";
import { Logger, PlatformConfig } from "homebridge";

export interface BatteryStatus {
  Apparent_output: number;
  BackupBuffer: number;
  BatteryCharging: boolean;
  BatteryDischarging: boolean;
  Consumption_W: number;
  Fac: number;
  FlowConsumptionBattery: boolean;
  FlowConsumptionGrid: boolean;
  FlowConsumptionProduction: boolean;
  FlowGridBattery: boolean;
  FlowProductionBattery: boolean;
  FlowProductionGrid: boolean;
  GridFeedIn_W: number;
  IsSystemInstalled: number;
  OperatingMode: string;
  Pac_total_W: number; //AC Power greater than ZERO is discharging Inverter AC Power less than ZERO is charging
  Production_W: number;
  RSOC: number;
  Sac1: null | number;
  Sac2: null | number;
  Sac3: null | number;
  SystemStatus: string;
  Timestamp: string;
  USOC: number;
  Uac: number;
  Ubat: number;
  dischargeNotAllowed: boolean;
  generator_autostart: boolean;
}

export interface SonnenConfiguration {
  CM_MarketingModuleCapacity: string;
  CN_CascadingRole: string;
  DE_Software: string;
  EM_OperatingMode: string;
  EM_Prognosis_Charging: string;
  EM_RE_ENABLE_MICROGRID: string;
  EM_ToU_Schedule: string;
  EM_USER_INPUT_TIME_ONE: string;
  EM_USER_INPUT_TIME_THREE: string;
  EM_USER_INPUT_TIME_TWO: string;
  EM_USOC: string;
  EM_US_CHP_Max_SOC: string;
  EM_US_CHP_Min_SOC: string;
  EM_US_GENRATOR_TYPE: string;
  EM_US_GEN_POWER_SET_POINT: string;
  EM_US_RE_ENABLE_MICROGRID: string;
  EM_US_USER_INPUT_TIME_ONE: string;
  EM_US_USER_INPUT_TIME_THREE: string;
  EM_US_USER_INPUT_TIME_TWO: string;
  IC_BatteryModules: string;
  IC_InverterMaxPower_w: string;
  NVM_PfcFixedCosPhi: string;
  NVM_PfcIsFixedCosPhiActive: string;
  NVM_PfcIsFixedCosPhiLagging: string;
  SH_HeaterOperatingMode: string;
  SH_HeaterTemperatureMax: string;
  SH_HeaterTemperatureMin: string;
}

export interface InverterStatus {
  fac: number;
  iac_total: number;
  ibat: number;
  ipv: number;
  pac_microgrid: number;
  pac_total: number;
  pbat: number;
  phi: number;
  ppv: number;
  sac_total: number;
  tmax: number;
  uac: number;
  ubat: number;
  upv: number;
}

export class SonnenAPI {
  version: number;
  interval: number;
  private sonnenURL: string | null;
  private sonnenToken: string | null;
  private sonnenSerial: string;
  private log: Logger;

  private Endpoints = {
    Status: "status",
    Latest: "latestdata",
    Configurations: "configurations",
    Inverter: "inverter",
  };

  public batteryStatus: BatteryStatus;
  public inverterStatus: InverterStatus;

  constructor(
    version: number,
    interval: number,
    config: PlatformConfig,
    log: Logger,
  ) {
    this.version = version;
    this.interval = interval;
    this.sonnenURL = config.sonnenURL;
    this.sonnenToken = config.sonnenToken;
    this.sonnenSerial = config.sonnenSerial;
    this.log = log;

    this.batteryStatus = {
      Apparent_output: 0,
      BackupBuffer: 0,
      BatteryCharging: false,
      BatteryDischarging: false,
      Consumption_W: 0,
      Fac: 0,
      FlowConsumptionBattery: false,
      FlowConsumptionGrid: false,
      FlowConsumptionProduction: false,
      FlowGridBattery: false,
      FlowProductionBattery: false,
      FlowProductionGrid: false,
      GridFeedIn_W: 0,
      IsSystemInstalled: 0,
      OperatingMode: "",
      Pac_total_W: 0,
      Production_W: 0,
      RSOC: 0,
      Sac1: null,
      Sac2: null,
      Sac3: null,
      SystemStatus: "",
      Timestamp: "",
      USOC: 0,
      Uac: 0,
      Ubat: 0,
      dischargeNotAllowed: false,
      generator_autostart: false,
    };

    this.inverterStatus = {
      fac: 0,
      iac_total: 0,
      ibat: 0,
      ipv: 0,
      pac_microgrid: 0,
      pac_total: 0,
      pbat: 0,
      phi: 0,
      ppv: 0,
      sac_total: 0,
      tmax: 0,
      uac: 0,
      ubat: 0,
      upv: 0,
    };
  }

  serial(): string {
    return this.sonnenSerial ?? "SB00000";
  }

  displayName(): string {
    return "Sonnen";
  }

  private makeURL(endpoint: string): string {
    //TODO: throw when there's no sonnenURL, sonnenToken
    const sonnenURL = this.sonnenURL ?? "192.168.68.51";
    const url = `http://${sonnenURL}/api/v${this.version}/${endpoint}`;
    return url;
  }

  private async fetchData<Result>(url: string): Promise<Result> {
    this.log.debug(`fetching from url: ${url}, token: ${this.sonnenToken}`);

    const response: AxiosResponse = await axios.get<Result>(url, {
      headers: {
        "Content-Type": "application/json",
        "Auth-Token": this.sonnenToken,
      },
    });
    const data = response.data;
    return data;
  }

  async reloadInverterStatus() {
    const statusEndpoint = this.Endpoints.Inverter;
    const url = this.makeURL(statusEndpoint);
    this.inverterStatus = await this.fetchData(url);
  }

  async fetchConfiguration(): Promise<SonnenConfiguration> {
    const statusEndpoint = this.Endpoints.Configurations;
    const url = this.makeURL(statusEndpoint);
    return await this.fetchData(url);
  }

  async reloadBatteryStatus() {
    const statusEndpoint = this.Endpoints.Status;
    const url = this.makeURL(statusEndpoint);
    this.batteryStatus = await this.fetchData(url);
  }

  async fetchLatestData(): Promise<void> {
    const latestEndpoint = this.Endpoints.Latest;
    const url = this.makeURL(latestEndpoint);
    return await this.fetchData(url);
  }
}
