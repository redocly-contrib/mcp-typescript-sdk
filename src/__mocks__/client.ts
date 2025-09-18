import { z } from "zod";
import { Protocol } from "../shared/protocol.js";
import { Transport } from "../shared/transport.js";
import { Request, Notification, Result, LATEST_PROTOCOL_VERSION } from "../types.js";

interface Tool {
  name: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

interface Prompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: unknown[];
  [key: string]: unknown;
}

interface Resource {
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  [key: string]: unknown;
}

interface ResourceTemplate {
  name: string;
  title?: string;
  description?: string;
  uriTemplate: string;
  [key: string]: unknown;
}

interface ResourceContent {
  uri: string;
  text?: string;
  blob?: string;
  [key: string]: unknown;
}

export class Client extends Protocol<Request, Notification, Result> {
  private _clientInfo: { name: string; version: string };
  private _capabilities?: Record<string, unknown>;

  constructor(
    clientInfo: { name: string; version: string },
    options?: { capabilities?: Record<string, unknown> }
  ) {
    super();
    this._clientInfo = clientInfo;
    this._capabilities = options?.capabilities;
  }

  protected assertCapabilityForMethod(): void {}
  protected assertNotificationCapability(): void {}
  protected assertRequestHandlerCapability(): void {}

  async connect(transport: Transport): Promise<void> {
    await super.connect(transport);

    // Send initialize request after connecting
    const initResponse = await this.request(
      {
        method: "initialize",
        params: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: this._capabilities || {},
          clientInfo: this._clientInfo
        }
      },
      z.object({
        protocolVersion: z.string(),
        capabilities: z.object({}).passthrough(),
        serverInfo: z.object({
          name: z.string(),
          version: z.string(),
          title: z.string().optional()
        }).passthrough()
      }).passthrough()
    );

    this._serverInfo = initResponse.serverInfo;
    this._serverCapabilities = initResponse.capabilities;

    // Send initialized notification
    await this.notification({ method: "notifications/initialized" });
  }

  async setLoggingLevel(level: string): Promise<void> {
    await this.request(
      { method: "logging/setLevel", params: { level } },
      z.object({}).passthrough()
    );
  }

  async listTools(): Promise<{ tools: Tool[] }> {
    return await this.request(
      { method: "tools/list" },
      z.object({
        tools: z.array(z.object({
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional()
        }).passthrough())
      })
    );
  }

  async listPrompts(): Promise<{ prompts: Prompt[] }> {
    return await this.request(
      { method: "prompts/list" },
      z.object({
        prompts: z.array(z.object({
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          arguments: z.array(z.unknown()).optional()
        }).passthrough())
      })
    );
  }

  async listResources(): Promise<{ resources: Resource[] }> {
    return await this.request(
      { method: "resources/list" },
      z.object({
        resources: z.array(z.object({
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          mimeType: z.string().optional()
        }).passthrough())
      })
    );
  }

  async listResourceTemplates(): Promise<{ resourceTemplates: ResourceTemplate[] }> {
    return await this.request(
      { method: "resources/templates/list" },
      z.object({
        resourceTemplates: z.array(z.object({
          name: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          uriTemplate: z.string()
        }).passthrough())
      })
    );
  }

  async readResource(params: { uri: string }): Promise<{ contents: ResourceContent[] }> {
    return await this.request(
      { method: "resources/read", params },
      z.object({
        contents: z.array(z.object({
          uri: z.string(),
          text: z.string().optional(),
          blob: z.string().optional()
        }).passthrough())
      })
    );
  }

  private _serverInfo?: { name: string; version: string; title?: string };

  getServerVersion(): { name: string; version: string; title?: string } | undefined {
    return this._serverInfo;
  }

  async callTool(params: { name: string; arguments?: unknown }): Promise<{ content: unknown[]; isError?: boolean }> {
    return await this.request(
      { method: "tools/call", params },
      z.object({
        content: z.array(z.unknown()),
        isError: z.boolean().optional()
      }).passthrough()
    );
  }

  private _serverCapabilities?: Record<string, unknown>;

  getServerCapabilities(): Record<string, unknown> | undefined {
    return this._serverCapabilities;
  }

  // The setNotificationHandler method is inherited from Protocol and should work correctly

  // The setRequestHandler method is inherited from Protocol and should work correctly

  fallbackNotificationHandler?: (notification: unknown) => Promise<void>;
}