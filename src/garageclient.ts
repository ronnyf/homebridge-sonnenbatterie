import { Logger } from 'homebridge';
import mqtt, { IClientOptions, IClientPublishOptions, IClientSubscribeOptions, ISubscriptionGrant, MqttClient, OnMessageCallback } from 'mqtt';

export class SonnenMQTT {

  private client: MqttClient | null;
  private rootTopic: string;

  constructor(client: MqttClient | null, rootTopic: string) {
    this.client = client;
    this.rootTopic = rootTopic;
  }

  connect(clientID: string, username: string, password: string, host: string, log: Logger | null = null) {
    log?.debug("connecting... (user: ", username, "), password: (****))");
    const opts: IClientOptions = {
        clientId: clientID,
        rejectUnauthorized: true,
        clean: true,
        username: username,
        password: password,
    };
    this.client = mqtt.connect(host, opts);
    log?.debug("did connect, client...");
  }

  async connectAsync(clientID: string, username: string, password: string, host: string, log: Logger | null = null): Promise<void> {
    log?.debug("connecting async... (user: ", username, "), password: (****)");
    const opts: IClientOptions = {
        clientId: clientID,
        rejectUnauthorized: true,
        clean: true,
        username: username,
        password: password,
    };
    this.client = await mqtt.connectAsync(host, opts);
    log?.debug("did connect, client...");
  }

  reconnect(): boolean {
    if (this.client === null) { return false; }
    if (this.client.connected == true) {
      return true
    }
    this.client = this.client.reconnect()
    return this.client !== null;
  }

  getConnected(): boolean {
    if (this.client === null) { return false; }
    return this.client.connected;
  }

  getClient(): MqttClient | null {
    return this.client;
  }

  async addSubscription(topic: string | string[]): Promise<ISubscriptionGrant[] | null> {
    const opts: IClientSubscribeOptions = { qos: 1 };
    // qos: 1 means we want the message to arrive at least once but don't care if it arrives twice (or more
    if (this.client === null) { 
      return null;
    }
    return this.client.subscribeAsync(topic, opts);
  }

  onMessage(callback: OnMessageCallback) {
    if (this.client === null) { return false; }
    this.client.on('message', callback);
  }

  publish<V>(topic: string, value: V, log: Logger | null) {
    log?.debug("pulishing ", value, " to topic ", topic);
    const stringValue = String(value);
    if (stringValue === undefined) {
      log?.error("cannot convert value ", value ," to string");
      return;
    }

    if (this.client === null) {
      log?.error("client is null");
      const success = this.reconnect();
      if (success == false) {
        log?.error("reconnect failed");
      }
    }

    const opts: IClientPublishOptions = {
      qos: 1,
      retain: false,
      properties: {
        messageExpiryInterval: 30
      }
    };

    const topicValue = this.rootTopic.concat("/").concat(topic);
    log?.debug("pulishing topic: ", topicValue, " << ", stringValue);

    if (this.client != null) {
      if (this.client.connected == false) {
        log?.error("client is not connected");
      }

      log?.debug("publishing value: ", stringValue);
      this.client.publish(topicValue, stringValue, opts);
    }
  }

  async disconnect() {
    if (this.client === null) { return false; }
    return this.client.endAsync;
  }

}