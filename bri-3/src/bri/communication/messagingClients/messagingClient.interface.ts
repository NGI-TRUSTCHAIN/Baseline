export interface IMessagingClient {
  subscribe(
    channelName: string,
    callback: (message: string) => Promise<boolean>,
  ): Promise<void>;
  publish(channelName: string, message: string): Promise<void>;
}
