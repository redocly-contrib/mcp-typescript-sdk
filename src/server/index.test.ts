/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Server } from "./index.js";
import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  SetLevelRequestSchema,
  ErrorCode,
  LoggingMessageNotification,
  CreateMessageRequest,
  CreateMessageResult,
  Request,
  Notification,
} from "../types.js";
import { RequestHandlerExtra } from "../shared/protocol.js";
import { Transport } from "../shared/transport.js";
import { InMemoryTransport } from "../inMemory.js";
import { z } from "zod";
import { Client } from "../__mocks__/client.js";

// Define missing schemas for testing
const CreateMessageRequestSchema = z.object({
  method: z.literal("sampling/createMessage"),
  params: z
    .object({
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.union([
            z.object({ type: z.literal("text"), text: z.string() }),
            z.object({
              type: z.literal("image"),
              data: z.string(),
              mimeType: z.string(),
            }),
            z.object({
              type: z.literal("audio"),
              data: z.string(),
              mimeType: z.string(),
            }),
          ]),
        })
      ),
      maxTokens: z.number(),
    })
    .passthrough(),
});

// ElicitRequestSchema removed - elicitInput not implemented

const RequestSchema = z.object({
  method: z.string(),
  params: z.optional(z.object({}).passthrough()),
});

const NotificationSchema = z.object({
  method: z.string(),
  params: z.optional(z.object({}).passthrough()),
});

const ResultSchema = z.object({}).passthrough();

// Simple Client class for testing

test("should accept latest protocol version", async () => {
  let sendPromiseResolve: (value: unknown) => void;
  const sendPromise = new Promise((resolve) => {
    sendPromiseResolve = resolve;
  });

  const serverTransport: Transport = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockImplementation((message) => {
      if (message.id === 1 && message.result) {
        expect(message.result).toEqual({
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: expect.any(Object),
          serverInfo: {
            name: "test server",
            version: "1.0",
          },
          instructions: "Test instructions",
        });
        sendPromiseResolve(undefined);
      }
      return Promise.resolve();
    }),
  };

  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
      instructions: "Test instructions",
    }
  );

  await server.connect(serverTransport);

  // Simulate initialize request with latest version
  serverTransport.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "test client",
        version: "1.0",
      },
    },
  });

  await expect(sendPromise).resolves.toBeUndefined();
});

test("should accept supported older protocol version", async () => {
  const OLD_VERSION = SUPPORTED_PROTOCOL_VERSIONS[1];
  let sendPromiseResolve: (value: unknown) => void;
  const sendPromise = new Promise((resolve) => {
    sendPromiseResolve = resolve;
  });

  const serverTransport: Transport = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockImplementation((message) => {
      if (message.id === 1 && message.result) {
        expect(message.result).toEqual({
          protocolVersion: OLD_VERSION,
          capabilities: expect.any(Object),
          serverInfo: {
            name: "test server",
            version: "1.0",
          },
        });
        sendPromiseResolve(undefined);
      }
      return Promise.resolve();
    }),
  };

  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
    }
  );

  await server.connect(serverTransport);

  // Simulate initialize request with older version
  serverTransport.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: OLD_VERSION,
      capabilities: {},
      clientInfo: {
        name: "test client",
        version: "1.0",
      },
    },
  });

  await expect(sendPromise).resolves.toBeUndefined();
});

test("should handle unsupported protocol version", async () => {
  let sendPromiseResolve: (value: unknown) => void;
  const sendPromise = new Promise((resolve) => {
    sendPromiseResolve = resolve;
  });

  const serverTransport: Transport = {
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockImplementation((message) => {
      if (message.id === 1 && message.result) {
        expect(message.result).toEqual({
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: expect.any(Object),
          serverInfo: {
            name: "test server",
            version: "1.0",
          },
        });
        sendPromiseResolve(undefined);
      }
      return Promise.resolve();
    }),
  };

  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
    }
  );

  await server.connect(serverTransport);

  // Simulate initialize request with unsupported version
  serverTransport.onmessage?.({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "invalid-version",
      capabilities: {},
      clientInfo: {
        name: "test client",
        version: "1.0",
      },
    },
  });

  await expect(sendPromise).resolves.toBeUndefined();
});

test("should respect client capabilities", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
      enforceStrictCapabilities: true,
    }
  );

  const client = new Client(
    {
      name: "test client",
      version: "1.0",
    },
    {
      capabilities: {
        sampling: {},
      },
    }
  );

  // Implement request handler for sampling/createMessage
  client.setRequestHandler(CreateMessageRequestSchema, async () => {
    // Mock implementation of createMessage
    return {
      model: "test-model",
      role: "assistant",
      content: {
        type: "text",
        text: "This is a test response",
      },
    };
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  expect(server.getClientCapabilities()).toEqual({ sampling: {} });

  // This should work because sampling is supported by the client
  await expect(
    server.createMessage({
      messages: [],
      maxTokens: 10,
    })
  ).resolves.not.toThrow();

  // This should still throw because roots are not supported by the client
  await expect(server.listRoots()).rejects.toThrow(/^Client does not support/);
});

test("should respect server notification capabilities", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        logging: {},
      },
      enforceStrictCapabilities: true,
    }
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  // This should work because logging is supported by the server
  await expect(
    server.sendLoggingMessage({
      level: "info",
      data: "Test log message",
    })
  ).resolves.not.toThrow();

  // This should throw because resource notifications are not supported by the server
  await expect(
    server.sendResourceUpdated({ uri: "test://resource" })
  ).rejects.toThrow(/^Server does not support/);
});

test("should only allow setRequestHandler for declared capabilities", () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
      },
    }
  );

  // These should work because the capabilities are declared
  expect(() => {
    server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: [] }));
  }).not.toThrow();

  expect(() => {
    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: [],
    }));
  }).not.toThrow();

  // These should throw because the capabilities are not declared
  expect(() => {
    server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [] }));
  }).toThrow(/^Server does not support tools/);

  expect(() => {
    server.setRequestHandler(SetLevelRequestSchema, () => ({}));
  }).toThrow(/^Server does not support logging/);
});

/*
  Test that custom request/notification/result schemas can be used with the Server class.
  */
test("should typecheck", () => {
  const GetWeatherRequestSchema = RequestSchema.extend({
    method: z.literal("weather/get"),
    params: z.object({
      city: z.string(),
    }),
  });

  const GetForecastRequestSchema = RequestSchema.extend({
    method: z.literal("weather/forecast"),
    params: z.object({
      city: z.string(),
      days: z.number(),
    }),
  });

  const WeatherForecastNotificationSchema = NotificationSchema.extend({
    method: z.literal("weather/alert"),
    params: z.object({
      severity: z.enum(["warning", "watch"]),
      message: z.string(),
    }),
  });

  const WeatherRequestSchema = GetWeatherRequestSchema.or(
    GetForecastRequestSchema
  );
  const WeatherNotificationSchema = WeatherForecastNotificationSchema;
  const WeatherResultSchema = ResultSchema.extend({
    temperature: z.number(),
    conditions: z.string(),
  });

  type WeatherRequest = z.infer<typeof WeatherRequestSchema>;
  type WeatherNotification = z.infer<typeof WeatherNotificationSchema>;
  type WeatherResult = z.infer<typeof WeatherResultSchema>;

  // Create a typed Server for weather data
  const weatherServer = new Server<
    WeatherRequest,
    WeatherNotification,
    WeatherResult
  >(
    {
      name: "WeatherServer",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
    }
  );

  // Typecheck that only valid weather requests/notifications/results are allowed
  weatherServer.setRequestHandler(GetWeatherRequestSchema, (request) => {
    return {
      temperature: 72,
      conditions: "sunny",
    };
  });

  weatherServer.setNotificationHandler(
    WeatherForecastNotificationSchema,
    (notification) => {
      console.log(`Weather alert: ${notification.params.message}`);
    }
  );
});

test("should handle server cancelling a request", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        sampling: {},
      },
    }
  );

  const client = new Client(
    {
      name: "test client",
      version: "1.0",
    },
    {
      capabilities: {
        sampling: {},
      },
    }
  );

  // Set up client to delay responding to createMessage
  client.setRequestHandler(
    CreateMessageRequestSchema,
    async (
      _request: CreateMessageRequest,
      _extra: RequestHandlerExtra<Request, Notification>
    ): Promise<CreateMessageResult> => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        model: "test",
        role: "assistant",
        content: {
          type: "text",
          text: "Test response",
        },
      };
    }
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Set up abort controller
  const controller = new AbortController();

  // Issue request but cancel it immediately
  const createMessagePromise = server.createMessage(
    {
      messages: [],
      maxTokens: 10,
    },
    {
      signal: controller.signal,
    }
  );
  controller.abort("Cancelled by test");

  // Request should be rejected
  await expect(createMessagePromise).rejects.toBe("Cancelled by test");
});

test("should handle request timeout", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        sampling: {},
      },
    }
  );

  // Set up client that delays responses
  const client = new Client(
    {
      name: "test client",
      version: "1.0",
    },
    {
      capabilities: {
        sampling: {},
      },
    }
  );

  client.setRequestHandler(
    CreateMessageRequestSchema,
    async (
      _request: CreateMessageRequest,
      _extra: RequestHandlerExtra<Request, Notification>
    ): Promise<CreateMessageResult> => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      return {
        model: "test",
        role: "assistant",
        content: {
          type: "text",
          text: "Test response",
        },
      };
    }
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Request with 0 msec timeout should fail immediately
  await expect(
    server.createMessage(
      {
        messages: [],
        maxTokens: 10,
      },
      { timeout: 0 }
    )
  ).rejects.toMatchObject({
    code: ErrorCode.RequestTimeout,
  });
});

/*
  Test automatic log level handling for transports with and without sessionId
 */
test("should respect log level for transport without sessionId", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
      enforceStrictCapabilities: true,
    }
  );

  const client = new Client({
    name: "test client",
    version: "1.0",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  expect(clientTransport.sessionId).toEqual(undefined);

  // Client sets logging level to warning
  await client.setLoggingLevel("warning");

  // This one will make it through
  const warningParams: LoggingMessageNotification["params"] = {
    level: "warning",
    logger: "test server",
    data: "Warning message",
  };

  // This one will not
  const debugParams: LoggingMessageNotification["params"] = {
    level: "debug",
    logger: "test server",
    data: "Debug message",
  };

  // Test the one that makes it through
  clientTransport.onmessage = jest.fn().mockImplementation((message) => {
    expect(message).toEqual({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: warningParams,
    });
  });

  // This one will not make it through
  await server.sendLoggingMessage(debugParams);
  expect(clientTransport.onmessage).not.toHaveBeenCalled();

  // This one will, triggering the above test in clientTransport.onmessage
  await server.sendLoggingMessage(warningParams);
  expect(clientTransport.onmessage).toHaveBeenCalled();
});

test("should respect log level for transport with sessionId", async () => {
  const server = new Server(
    {
      name: "test server",
      version: "1.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
        logging: {},
      },
      enforceStrictCapabilities: true,
    }
  );

  const client = new Client({
    name: "test client",
    version: "1.0",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  // Add a session id to the transports
  const SESSION_ID = "test-session-id";
  clientTransport.sessionId = SESSION_ID;
  serverTransport.sessionId = SESSION_ID;

  expect(clientTransport.sessionId).toBeDefined();
  expect(serverTransport.sessionId).toBeDefined();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  // Client sets logging level to warning
  await client.setLoggingLevel("warning");

  // This one will make it through
  const warningParams: LoggingMessageNotification["params"] = {
    level: "warning",
    logger: "test server",
    data: "Warning message",
  };

  // This one will not
  const debugParams: LoggingMessageNotification["params"] = {
    level: "debug",
    logger: "test server",
    data: "Debug message",
  };

  // Test the one that makes it through
  clientTransport.onmessage = jest.fn().mockImplementation((message) => {
    expect(message).toEqual({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: warningParams,
    });
  });

  // This one will not make it through
  await server.sendLoggingMessage(debugParams, SESSION_ID);
  expect(clientTransport.onmessage).not.toHaveBeenCalled();

  // This one will, triggering the above test in clientTransport.onmessage
  await server.sendLoggingMessage(warningParams, SESSION_ID);
  expect(clientTransport.onmessage).toHaveBeenCalled();
});
