import { Logger, PlatformConfig } from "homebridge"
import mqtt, { MqttClient, IClientOptions, IClientPublishOptions } from 'mqtt';

export class SonnenMQTT {
  private config: PlatformConfig
  private log: Logger;
  private client: MqttClient | null;

  // constructor(host: string, user: string, password: string, log: Logger) {
  //   this.host = host;
  //   this.user = user;
  //   this.password = password;
  //   this.log = log;
  //   this.client = null;
  // }

  constructor(config: PlatformConfig, log: Logger) {
    this.config = config;
    this.log = log;
    this.client = null;
  }

connect(clientID: string | null) {
    this.log.debug('using client id: ', clientID);

    if (this.client == null) {
  
      const username = this.getUser() ?? "" ;
      const password = this.getPassword() ?? "";
      const host = this.getHost()

        const opts: IClientOptions = {
          clientId : clientID ?? this.getClientID(),
          rejectUnauthorized: false,
          clean: true,
          username: username,
          password: password
        };

        const client = mqtt.connect(host, opts);
        this.log.debug('connecting to mqtt host: ', host);
        this.configureMQTT(client);
        this.client = client
        this.log.debug('connected to mqtt host: ', host);
      
    } else {
      this.log.debug('already connected to mqtt host');
    }
  }

  getClientID(): string { 
    return this.config["mqttClientID"] ?? "Sonnen-MQTT"
  }

  getUser(): string | null { 
    return this.config["mqttUser"] ?? ""
  }

  getPassword(): string | null { 
    return this.config["mqttPassword"] ?? ""
  }

  getHost(): string { 
    return this.config["mqttHost"] ?? "mqtt://localhost:1883"
  }

  getRootTopic(): string { 
    return this.config['mqttRootTopic'] ?? "Sonnen"
  }

  configureMQTT(mqttClient: MqttClient) {
    this.log.debug('configuring mqtt connect callback');
    mqttClient.on('connect', (/*packet: IConnectPacket*/) => {

      // this.log.info('connected to broker, packet: ', packet);
      //nothing interesting in the packet here:
      /*
          Packet {
            cmd: 'connack',
            retain: false,
            qos: 0,
            dup: false,
            length: 2,
            topic: null,
            payload: null,
            sessionPresent: false,
            returnCode: 0
          }
        */

      // what topics should we read? Probably none.
      // this would also be the place to receive mqtt messages ... we keep this clean for now
    }); //onConnect

    this.log.debug('configuring mqtt close callback');
    mqttClient.on('close', () => {
      this.log.info('disconnected from broker');
    });
  }

  update<V>(value: V, key: string) {
    if (this.client == null) { 
      this.connect(null)
    }

    this.log.debug('updating mqtt key: ', key, ' -> value: ', value);
    const opts: IClientPublishOptions = {
      qos: 0,
      retain: false,
      properties: {
        messageExpiryInterval: 10
      }
    };

    const topic = this.getRootTopic().concat("/").concat(key);
    this.client?.publish(topic, String(value), opts);
  }
}