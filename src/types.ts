import { z } from "zod";
import { AuthInfo } from "./server/types.js";

export const LATEST_PROTOCOL_VERSION = "2025-06-18";
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
export const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];

/* JSON-RPC types */
export const JSONRPC_VERSION = "2.0";

/**
 * A progress token, used to associate progress notifications with the original request.
 */
export type ProgressToken = string | number;

/**
 * An opaque token used to represent a cursor for pagination.
 */
export type Cursor = string;

/**
 * Request metadata interface
 */
export interface RequestMeta {
  /**
   * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
   */
  progressToken?: ProgressToken;
  [key: string]: unknown;
}

/**
 * Base request parameters interface
 */
export interface BaseRequestParams {
  _meta?: RequestMeta;
  [key: string]: unknown;
}

/**
 * Request interface
 */
export interface Request {
  method: string;
  params?: BaseRequestParams;
}

/**
 * Base notification parameters interface
 */
export interface BaseNotificationParams {
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Notification interface
 */
export interface Notification {
  method: string;
  params?: BaseNotificationParams;
}

/**
 * Result interface
 */
export interface Result {
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
export type RequestId = string | number;

/**
 * A request that expects a response.
 */
export interface JSONRPCRequest extends Request {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
}

// Keep Zod schema for validation
export const JSONRPCRequestSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    method: z.string(),
    params: z.optional(
      z
        .object({
          _meta: z.optional(
            z
              .object({
                progressToken: z.optional(
                  z.union([z.string(), z.number().int()])
                ),
              })
              .passthrough()
          ),
        })
        .passthrough()
    ),
  })
  .strict();

export const isJSONRPCRequest = (value: unknown): value is JSONRPCRequest =>
  JSONRPCRequestSchema.safeParse(value).success;

/**
 * A notification which does not expect a response.
 */
export interface JSONRPCNotification extends Notification {
  jsonrpc: typeof JSONRPC_VERSION;
}

// Keep Zod schema for validation
const JSONRPCNotificationSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    method: z.string(),
    params: z.optional(
      z.object({ _meta: z.optional(z.object({}).passthrough()) }).passthrough()
    ),
  })
  .strict();

export const isJSONRPCNotification = (
  value: unknown
): value is JSONRPCNotification =>
  JSONRPCNotificationSchema.safeParse(value).success;

/**
 * A successful (non-error) response to a request.
 */
export interface JSONRPCResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  result: Result;
}

// Keep Zod schema for validation
const JSONRPCResponseSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    result: z
      .object({ _meta: z.optional(z.object({}).passthrough()) })
      .passthrough(),
  })
  .strict();

export const isJSONRPCResponse = (value: unknown): value is JSONRPCResponse =>
  JSONRPCResponseSchema.safeParse(value).success;

/**
 * Error codes defined by the JSON-RPC specification.
 */
export enum ErrorCode {
  // SDK error codes
  ConnectionClosed = -32000,
  RequestTimeout = -32001,

  // Standard JSON-RPC error codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

/**
 * A response to a request that indicates an error occurred.
 */
export interface JSONRPCError {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  error: {
    /**
     * The error type that occurred.
     */
    code: number;
    /**
     * A short description of the error. The message SHOULD be limited to a concise single sentence.
     */
    message: string;
    /**
     * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
     */
    data?: unknown;
  };
}

// Keep Zod schema for validation
const JSONRPCErrorSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
      data: z.optional(z.unknown()),
    }),
  })
  .strict();

export const isJSONRPCError = (value: unknown): value is JSONRPCError =>
  JSONRPCErrorSchema.safeParse(value).success;

/**
 * JSON-RPC message type
 */
export type JSONRPCMessage =
  | JSONRPCRequest
  | JSONRPCNotification
  | JSONRPCResponse
  | JSONRPCError;

/* Empty result */
/**
 * A response that indicates success but carries no data.
 */

/* Cancellation */
/**
 * This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
 *
 * The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished.
 *
 * This notification indicates that the result will be unused, so any associated processing SHOULD cease.
 *
 * A client MUST NOT attempt to cancel its `initialize` request.
 */
export interface CancelledNotification extends Notification {
  method: "notifications/cancelled";
  params: BaseNotificationParams & {
    /**
     * The ID of the request to cancel.
     *
     * This MUST correspond to the ID of a request previously issued in the same direction.
     */
    requestId: RequestId;

    /**
     * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
     */
    reason?: string;
  };
}

/* Base Metadata */
/**
 * Icon schema for use in tools, prompts, resources, and implementations.
 */
export interface Icon {
  /**
   * URL or data URI for the icon.
   */
  src: string;
  /**
   * Optional MIME type for the icon.
   */
  mimeType?: string;
  /**
   * Optional string specifying icon dimensions (e.g., "48x48 96x96").
   */
  sizes?: string;
  [key: string]: unknown;
}

/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
export interface BaseMetadata {
  /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
  name: string;
  /**
   * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
   * even by those unfamiliar with domain-specific terminology.
   *
   * If not provided, the name should be used for display (except for Tool,
   * where `annotations.title` should be given precedence over using `name`,
   * if present).
   */
  title?: string;
  [key: string]: unknown;
}

/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
export interface Implementation extends BaseMetadata {
  version: string;
  /**
   * An optional URL of the website for this implementation.
   */
  websiteUrl?: string;
  /**
   * An optional list of icons for this implementation.
   * This can be used by clients to display the implementation in a user interface.
   * Each icon should have a `kind` property that specifies whether it is a data representation or a URL source, a `src` property that points to the icon file or data representation, and may also include a `mimeType` and `sizes` property.
   * The `mimeType` property should be a valid MIME type for the icon file, such as "image/png" or "image/svg+xml".
   * The `sizes` property should be a string that specifies one or more sizes at which the icon file can be used, such as "48x48" or "any" for scalable formats like SVG.
   * The `sizes` property is optional, and if not provided, the client should assume that the icon can be used at any size.
   */
  icons?: Icon[];
}

/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
export interface ClientCapabilities {
  /**
   * Experimental, non-standard capabilities that the client supports.
   */
  experimental?: { [key: string]: unknown };
  /**
   * Present if the client supports sampling from an LLM.
   */
  sampling?: { [key: string]: unknown };
  /**
   * Present if the client supports eliciting user input.
   */
  elicitation?: { [key: string]: unknown };
  /**
   * Present if the client supports listing roots.
   */
  roots?: {
    /**
     * Whether the client supports issuing notifications for changes to the roots list.
     */
    listChanged?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
export interface InitializeRequest extends Request {
  method: "initialize";
  params: BaseRequestParams & {
    /**
     * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
     */
    protocolVersion: string;
    capabilities: ClientCapabilities;
    clientInfo: Implementation;
  };
}

// Keep Zod schema for validation
export const InitializeRequestSchema = z.object({
  method: z.literal("initialize"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      protocolVersion: z.string(),
      capabilities: z.object({}).passthrough(),
      clientInfo: z.object({}).passthrough(),
    })
    .passthrough(),
});

export const isInitializeRequest = (
  value: unknown
): value is InitializeRequest =>
  InitializeRequestSchema.safeParse(value).success;

/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
export interface ServerCapabilities {
  /**
   * Experimental, non-standard capabilities that the server supports.
   */
  experimental?: { [key: string]: unknown };
  /**
   * Present if the server supports sending log messages to the client.
   */
  logging?: { [key: string]: unknown };
  /**
   * Present if the server supports sending completions to the client.
   */
  completions?: { [key: string]: unknown };
  /**
   * Present if the server offers any prompt templates.
   */
  prompts?: {
    /**
     * Whether this server supports issuing notifications for changes to the prompt list.
     */
    listChanged?: boolean;
    [key: string]: unknown;
  };
  /**
   * Present if the server offers any resources to read.
   */
  resources?: {
    /**
     * Whether this server supports clients subscribing to resource updates.
     */
    subscribe?: boolean;

    /**
     * Whether this server supports issuing notifications for changes to the resource list.
     */
    listChanged?: boolean;
    [key: string]: unknown;
  };
  /**
   * Present if the server offers any tools to call.
   */
  tools?: {
    /**
     * Whether this server supports issuing notifications for changes to the tool list.
     */
    listChanged?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * After receiving an initialize request from the client, the server sends this response.
 */
export interface InitializeResult extends Result {
  /**
   * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
   */
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  /**
   * Instructions describing how to use the server and its features.
   *
   * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
   */
  instructions?: string;
}

/**
 * This notification is sent from the client to the server after initialization has finished.
 */
export interface InitializedNotification extends Notification {
  method: "notifications/initialized";
}

// Keep Zod schema for validation
export const InitializedNotificationSchema = z.object({
  method: z.literal("notifications/initialized"),
  params: z.optional(
    z.object({ _meta: z.optional(z.object({}).passthrough()) }).passthrough()
  ),
});

export const isInitializedNotification = (
  value: unknown
): value is InitializedNotification =>
  InitializedNotificationSchema.safeParse(value).success;

// Export additional Zod schemas needed for validation in server files
export const JSONRPCMessageSchema = z.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema,
]);

export const EmptyResultSchema = z
  .object({ _meta: z.optional(z.object({}).passthrough()) })
  .passthrough();

export type EmptyResult = Result;

export const ListToolsRequestSchema = z.object({
  method: z.literal("tools/list"),
  params: z.optional(
    z
      .object({
        _meta: z.optional(
          z
            .object({
              progressToken: z.optional(
                z.union([z.string(), z.number().int()])
              ),
            })
            .passthrough()
        ),
        cursor: z.optional(z.string()),
      })
      .passthrough()
  ),
});

export const CallToolRequestSchema = z.object({
  method: z.literal("tools/call"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      name: z.string(),
      arguments: z.optional(z.record(z.unknown())),
    })
    .passthrough(),
});

export const ListResourcesRequestSchema = z.object({
  method: z.literal("resources/list"),
  params: z.optional(
    z
      .object({
        _meta: z.optional(
          z
            .object({
              progressToken: z.optional(
                z.union([z.string(), z.number().int()])
              ),
            })
            .passthrough()
        ),
        cursor: z.optional(z.string()),
      })
      .passthrough()
  ),
});

export const ListResourceTemplatesRequestSchema = z.object({
  method: z.literal("resources/templates/list"),
  params: z.optional(
    z
      .object({
        _meta: z.optional(
          z
            .object({
              progressToken: z.optional(
                z.union([z.string(), z.number().int()])
              ),
            })
            .passthrough()
        ),
        cursor: z.optional(z.string()),
      })
      .passthrough()
  ),
});

export const ReadResourceRequestSchema = z.object({
  method: z.literal("resources/read"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      uri: z.string(),
    })
    .passthrough(),
});

export const ListPromptsRequestSchema = z.object({
  method: z.literal("prompts/list"),
  params: z.optional(
    z
      .object({
        _meta: z.optional(
          z
            .object({
              progressToken: z.optional(
                z.union([z.string(), z.number().int()])
              ),
            })
            .passthrough()
        ),
        cursor: z.optional(z.string()),
      })
      .passthrough()
  ),
});

export const GetPromptRequestSchema = z.object({
  method: z.literal("prompts/get"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      name: z.string(),
      arguments: z.optional(z.record(z.string())),
    })
    .passthrough(),
});

export const CompleteRequestSchema = z.object({
  method: z.literal("completion/complete"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      ref: z.union([
        z
          .object({ type: z.literal("ref/prompt"), name: z.string() })
          .passthrough(),
        z
          .object({ type: z.literal("ref/resource"), uri: z.string() })
          .passthrough(),
      ]),
      argument: z
        .object({
          name: z.string(),
          value: z.string(),
        })
        .passthrough(),
      context: z.optional(
        z.object({
          arguments: z.optional(z.record(z.string(), z.string())),
        })
      ),
    })
    .passthrough(),
});

export const SetLevelRequestSchema = z.object({
  method: z.literal("logging/setLevel"),
  params: z
    .object({
      _meta: z.optional(
        z
          .object({
            progressToken: z.optional(z.union([z.string(), z.number().int()])),
          })
          .passthrough()
      ),
      level: z.enum([
        "debug",
        "info",
        "notice",
        "warning",
        "error",
        "critical",
        "alert",
        "emergency",
      ]),
    })
    .passthrough(),
});

export const LoggingLevelSchema = z.enum([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
]);

export const CreateMessageResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    model: z.string(),
    stopReason: z.optional(
      z.union([z.enum(["endTurn", "stopSequence", "maxTokens"]), z.string()])
    ),
    role: z.enum(["user", "assistant"]),
    content: z.union([
      z
        .object({
          type: z.literal("text"),
          text: z.string(),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough(),
      z
        .object({
          type: z.literal("image"),
          data: z.string(),
          mimeType: z.string(),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough(),
      z
        .object({
          type: z.literal("audio"),
          data: z.string(),
          mimeType: z.string(),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough(),
    ]),
  })
  .passthrough();

export const ElicitResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    action: z.enum(["accept", "decline", "cancel"]),
    content: z.optional(z.record(z.string(), z.unknown())),
  })
  .passthrough();

export const ListRootsResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    roots: z.array(
      z
        .object({
          uri: z.string(),
          name: z.optional(z.string()),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough()
    ),
  })
  .passthrough();

export const ListToolsResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    tools: z.array(
      z
        .object({
          name: z.string(),
          title: z.optional(z.string()),
          description: z.optional(z.string()),
          inputSchema: z.optional(z.object({}).passthrough()),
          outputSchema: z.optional(z.object({}).passthrough()),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough()
    ),
    nextCursor: z.optional(z.string()),
  })
  .passthrough();

export const CallToolResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    content: z.array(
      z.union([
        z
          .object({
            type: z.literal("text"),
            text: z.string(),
            _meta: z.optional(z.object({}).passthrough()),
          })
          .passthrough(),
        z
          .object({
            type: z.literal("image"),
            data: z.string(),
            mimeType: z.string(),
            _meta: z.optional(z.object({}).passthrough()),
          })
          .passthrough(),
        z
          .object({
            type: z.literal("resource"),
            resource: z
              .object({
                uri: z.string(),
                text: z.optional(z.string()),
                mimeType: z.optional(z.string()),
              })
              .passthrough(),
            _meta: z.optional(z.object({}).passthrough()),
          })
          .passthrough(),
      ])
    ),
    structuredContent: z.optional(z.record(z.string(), z.unknown())),
    isError: z.optional(z.boolean()),
  })
  .passthrough();

export const CompleteResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    completion: z
      .object({
        values: z.array(z.string()).max(100),
        total: z.optional(z.number()),
        hasMore: z.optional(z.boolean()),
      })
      .passthrough(),
  })
  .passthrough();

export const ListResourcesResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    resources: z.array(
      z
        .object({
          uri: z.string(),
          name: z.optional(z.string()),
          title: z.optional(z.string()),
          description: z.optional(z.string()),
          mimeType: z.optional(z.string()),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough()
    ),
    nextCursor: z.optional(z.string()),
  })
  .passthrough();

export const ReadResourceResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    contents: z.array(
      z.union([
        z
          .object({
            uri: z.string(),
            text: z.string(),
            mimeType: z.optional(z.string()),
            _meta: z.optional(z.object({}).passthrough()),
          })
          .passthrough(),
        z
          .object({
            uri: z.string(),
            blob: z.string(),
            mimeType: z.string(),
            _meta: z.optional(z.object({}).passthrough()),
          })
          .passthrough(),
      ])
    ),
  })
  .passthrough();

export const ListResourceTemplatesResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    resourceTemplates: z.array(
      z
        .object({
          uriTemplate: z.string(),
          name: z.optional(z.string()),
          title: z.optional(z.string()),
          description: z.optional(z.string()),
          mimeType: z.optional(z.string()),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough()
    ),
    nextCursor: z.optional(z.string()),
  })
  .passthrough();

export const ListPromptsResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    prompts: z.array(
      z
        .object({
          name: z.string(),
          title: z.optional(z.string()),
          description: z.optional(z.string()),
          arguments: z.optional(
            z.array(
              z
                .object({
                  name: z.string(),
                  description: z.optional(z.string()),
                  required: z.optional(z.boolean()),
                })
                .passthrough()
            )
          ),
          _meta: z.optional(z.object({}).passthrough()),
        })
        .passthrough()
    ),
    nextCursor: z.optional(z.string()),
  })
  .passthrough();

export const GetPromptResultSchema = z
  .object({
    _meta: z.optional(z.object({}).passthrough()),
    description: z.optional(z.string()),
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
            type: z.literal("resource"),
            resource: z.object({
              uri: z.string(),
              text: z.optional(z.string()),
              mimeType: z.optional(z.string()),
            }),
          }),
        ]),
      })
    ),
  })
  .passthrough();

export const LoggingMessageNotificationSchema = z.object({
  method: z.literal("notifications/message"),
  params: z
    .object({
      _meta: z.optional(z.object({}).passthrough()),
      level: z.enum([
        "debug",
        "info",
        "notice",
        "warning",
        "error",
        "critical",
        "alert",
        "emergency",
      ]),
      logger: z.optional(z.string()),
      data: z.unknown(),
    })
    .passthrough(),
});

export const CancelledNotificationSchema = z.object({
  method: z.literal("notifications/cancelled"),
  params: z
    .object({
      _meta: z.optional(z.object({}).passthrough()),
      requestId: z.union([z.string(), z.number().int()]),
      reason: z.optional(z.string()),
    })
    .passthrough(),
});

export const PingRequestSchema = z.object({
  method: z.literal("ping"),
  params: z.optional(
    z
      .object({
        _meta: z.optional(
          z
            .object({
              progressToken: z.optional(
                z.union([z.string(), z.number().int()])
              ),
            })
            .passthrough()
        ),
      })
      .passthrough()
  ),
});

export const ProgressNotificationSchema = z.object({
  method: z.literal("notifications/progress"),
  params: z
    .object({
      _meta: z.optional(z.object({}).passthrough()),
      progressToken: z.union([z.string(), z.number().int()]),
      progress: z.number(),
      total: z.optional(z.number()),
      message: z.optional(z.string()),
    })
    .passthrough(),
});

/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
export interface PingRequest extends Request {
  method: "ping";
}

/* Progress notifications */
/**
 * Progress information
 */
export interface Progress {
  /**
   * The progress thus far. This should increase every time progress is made, even if the total is unknown.
   */
  progress: number;
  /**
   * Total number of items to process (or total progress required), if known.
   */
  total?: number;
  /**
   * An optional message describing the current progress.
   */
  message?: string;
  [key: string]: unknown;
}

/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
export interface ProgressNotification extends Notification {
  method: "notifications/progress";
  params: BaseNotificationParams &
    Progress & {
      /**
       * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
       */
      progressToken: ProgressToken;
    };
}

/* Pagination */
/**
 * Paginated request interface
 */
export interface PaginatedRequest extends Request {
  params?: BaseRequestParams & {
    /**
     * An opaque token representing the current pagination position.
     * If provided, the server should return results starting after this cursor.
     */
    cursor?: Cursor;
  };
}

/**
 * Paginated result interface
 */
export interface PaginatedResult extends Result {
  /**
   * An opaque token representing the pagination position after the last returned result.
   * If present, there may be more results available.
   */
  nextCursor?: Cursor;
}

/* Resources */
/**
 * The contents of a specific resource or sub-resource.
 */
export interface ResourceContents {
  /**
   * The URI of this resource.
   */
  uri: string;
  /**
   * The MIME type of this resource, if known.
   */
  mimeType?: string;
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Text resource contents
 */
export interface TextResourceContents extends ResourceContents {
  /**
   * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
   */
  text: string;
}

/**
 * Blob resource contents
 */
export interface BlobResourceContents extends ResourceContents {
  /**
   * A base64-encoded string representing the binary data of the item.
   */
  blob: string; // Base64 string
}

/**
 * A known resource that the server is capable of reading.
 */
export interface Resource extends BaseMetadata {
  /**
   * The URI of this resource.
   */
  uri: string;

  /**
   * A description of what this resource represents.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description?: string;

  /**
   * The MIME type of this resource, if known.
   */
  mimeType?: string;

  /**
   * An optional list of icons for this resource.
   */
  icons?: Icon[];

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
}

/**
 * A template description for resources available on the server.
 */
export interface ResourceTemplate extends BaseMetadata {
  /**
   * A URI template (according to RFC 6570) that can be used to construct resource URIs.
   */
  uriTemplate: string;

  /**
   * A description of what this template is for.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description?: string;

  /**
   * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
   */
  mimeType?: string;

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Sent from the client to request a list of resources the server has.
 */
export interface ListResourcesRequest extends PaginatedRequest {
  method: "resources/list";
}

/**
 * The server's response to a resources/list request from the client.
 */
export interface ListResourcesResult extends PaginatedResult {
  resources: Resource[];
}

/**
 * Sent from the client to request a list of resource templates the server has.
 */
export interface ListResourceTemplatesRequest extends PaginatedRequest {
  method: "resources/templates/list";
}

/**
 * The server's response to a resources/templates/list request from the client.
 */
export interface ListResourceTemplatesResult extends PaginatedResult {
  resourceTemplates: ResourceTemplate[];
}

/**
 * Sent from the client to the server, to read a specific resource URI.
 */
export interface ReadResourceRequest extends Request {
  method: "resources/read";
  params: BaseRequestParams & {
    /**
     * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: string;
  };
}

/**
 * The server's response to a resources/read request from the client.
 */
export interface ReadResourceResult extends Result {
  contents: (TextResourceContents | BlobResourceContents)[];
}

/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
export interface ResourceListChangedNotification extends Notification {
  method: "notifications/resources/list_changed";
}

/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
export interface SubscribeRequest extends Request {
  method: "resources/subscribe";
  params: BaseRequestParams & {
    /**
     * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: string;
  };
}

/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
export interface UnsubscribeRequest extends Request {
  method: "resources/unsubscribe";
  params: BaseRequestParams & {
    /**
     * The URI of the resource to unsubscribe from.
     */
    uri: string;
  };
}

/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
export interface ResourceUpdatedNotification extends Notification {
  method: "notifications/resources/updated";
  params: BaseNotificationParams & {
    /**
     * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
     */
    uri: string;
  };
}

/* Prompts */
/**
 * Describes an argument that a prompt can accept.
 */
export interface PromptArgument {
  /**
   * The name of the argument.
   */
  name: string;
  /**
   * A human-readable description of the argument.
   */
  description?: string;
  /**
   * Whether this argument must be provided.
   */
  required?: boolean;
  [key: string]: unknown;
}

/**
 * A prompt or prompt template that the server offers.
 */
export interface Prompt extends BaseMetadata {
  /**
   * An optional description of what this prompt provides
   */
  description?: string;
  /**
   * A list of arguments to use for templating the prompt.
   */
  arguments?: PromptArgument[];
  /**
   * An optional list of icons for this prompt.
   */
  icons?: Icon[];
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
export interface ListPromptsRequest extends PaginatedRequest {
  method: "prompts/list";
}

/**
 * The server's response to a prompts/list request from the client.
 */
export interface ListPromptsResult extends PaginatedResult {
  prompts: Prompt[];
}

/**
 * Used by the client to get a prompt provided by the server.
 */
export interface GetPromptRequest extends Request {
  method: "prompts/get";
  params: BaseRequestParams & {
    /**
     * The name of the prompt or prompt template.
     */
    name: string;
    /**
     * Arguments to use for templating the prompt.
     */
    arguments?: Record<string, string>;
  };
}

/**
 * Text provided to or from an LLM.
 */
export interface TextContent {
  type: "text";
  /**
   * The text content of the message.
   */
  text: string;

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * An image provided to or from an LLM.
 */
export interface ImageContent {
  type: "image";
  /**
   * The base64-encoded image data.
   */
  data: string; // Base64 string
  /**
   * The MIME type of the image. Different providers may support different image types.
   */
  mimeType: string;

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * An Audio provided to or from an LLM.
 */
export interface AudioContent {
  type: "audio";
  /**
   * The base64-encoded audio data.
   */
  data: string; // Base64 string
  /**
   * The MIME type of the audio. Different providers may support different audio types.
   */
  mimeType: string;

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
export interface EmbeddedResource {
  type: "resource";
  resource: TextResourceContents | BlobResourceContents;
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
 */
export interface ResourceLink extends Resource {
  type: "resource_link";
}

/**
 * A content block that can be used in prompts and tool results.
 */
export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLink
  | EmbeddedResource;

/**
 * Describes a message returned as part of a prompt.
 */
export interface PromptMessage {
  role: "user" | "assistant";
  content: ContentBlock;
  [key: string]: unknown;
}

/**
 * The server's response to a prompts/get request from the client.
 */
export interface GetPromptResult extends Result {
  /**
   * An optional description for the prompt.
   */
  description?: string;
  messages: PromptMessage[];
}

/**
 * An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export interface PromptListChangedNotification extends Notification {
  method: "notifications/prompts/list_changed";
}

/* Tools */
/**
 * Additional properties describing a Tool to clients.
 *
 * NOTE: all properties in ToolAnnotations are **hints**.
 * They are not guaranteed to provide a faithful description of
 * tool behavior (including descriptive properties like `title`).
 *
 * Clients should never make tool use decisions based on ToolAnnotations
 * received from untrusted servers.
 */
export interface ToolAnnotations {
  /**
   * A human-readable title for the tool.
   */
  title?: string;

  /**
   * If true, the tool does not modify its environment.
   *
   * Default: false
   */
  readOnlyHint?: boolean;

  /**
   * If true, the tool may perform destructive updates to its environment.
   * If false, the tool performs only additive updates.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: true
   */
  destructiveHint?: boolean;

  /**
   * If true, calling the tool repeatedly with the same arguments
   * will have no additional effect on the its environment.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: false
   */
  idempotentHint?: boolean;

  /**
   * If true, this tool may interact with an "open world" of external
   * entities. If false, the tool's domain of interaction is closed.
   * For example, the world of a web search tool is open, whereas that
   * of a memory tool is not.
   *
   * Default: true
   */
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface ToolInputSchema {
  type: "object";
  properties?: { [key: string]: unknown };
  required?: string[];
  [key: string]: unknown;
}

/**
 * Definition for a tool the client can call.
 */
export interface Tool extends BaseMetadata {
  /**
   * A human-readable description of the tool.
   */
  description?: string;
  /**
   * A JSON Schema object defining the expected parameters for the tool.
   */
  inputSchema: ToolInputSchema;
  /**
   * An optional JSON Schema object defining the structure of the tool's output returned in
   * the structuredContent field of a CallToolResult.
   */
  outputSchema?: {
    type: "object";
    properties?: { [key: string]: unknown };
    required?: string[];
    [key: string]: unknown;
  };
  /**
   * Optional additional tool information.
   */
  annotations?: ToolAnnotations;

  /**
   * An optional list of icons for this tool.
   */
  icons?: Icon[];

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Sent from the client to request a list of tools the server has.
 */
export interface ListToolsRequest extends PaginatedRequest {
  method: "tools/list";
}

/**
 * The server's response to a tools/list request from the client.
 */
export interface ListToolsResult extends PaginatedResult {
  tools: Tool[];
}

/**
 * The server's response to a tool call.
 */
export interface CallToolResult extends Result {
  /**
   * A list of content objects that represent the result of the tool call.
   *
   * If the Tool does not define an outputSchema, this field MUST be present in the result.
   * For backwards compatibility, this field is always present, but it may be empty.
   */
  content: ContentBlock[];

  /**
   * An object containing structured tool output.
   *
   * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
   */
  structuredContent?: { [key: string]: unknown };

  /**
   * Whether the tool call ended in an error.
   *
   * If not set, this is assumed to be false (the call was successful).
   *
   * Any errors that originate from the tool SHOULD be reported inside the result
   * object, with `isError` set to true, _not_ as an MCP protocol-level error
   * response. Otherwise, the LLM would not be able to see that an error occurred
   * and self-correct.
   *
   * However, any errors in _finding_ the tool, an error indicating that the
   * server does not support tool calls, or any other exceptional conditions,
   * should be reported as an MCP error response.
   */
  isError?: boolean;
}

/**
 * Used by the client to invoke a tool provided by the server.
 */
export interface CallToolRequest extends Request {
  method: "tools/call";
  params: BaseRequestParams & {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export interface ToolListChangedNotification extends Notification {
  method: "notifications/tools/list_changed";
}

/* Logging */
/**
 * The severity of a log message.
 */
export type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

/**
 * A request from the client to the server, to enable or adjust logging.
 */
export interface SetLevelRequest extends Request {
  method: "logging/setLevel";
  params: BaseRequestParams & {
    /**
     * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
     */
    level: LoggingLevel;
  };
}

/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
export interface LoggingMessageNotification extends Notification {
  method: "notifications/message";
  params: BaseNotificationParams & {
    /**
     * The severity of this log message.
     */
    level: LoggingLevel;
    /**
     * An optional name of the logger issuing this message.
     */
    logger?: string;
    /**
     * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
     */
    data: unknown;
  };
}

/* Sampling */
/**
 * Hints to use for model selection.
 */
export interface ModelHint {
  /**
   * A hint for a model name.
   */
  name?: string;
  [key: string]: unknown;
}

/**
 * The server's preferences for model selection, requested of the client during sampling.
 */
export interface ModelPreferences {
  /**
   * Optional hints to use for model selection.
   */
  hints?: ModelHint[];
  /**
   * How much to prioritize cost when selecting a model.
   */
  costPriority?: number; // 0-1
  /**
   * How much to prioritize sampling speed (latency) when selecting a model.
   */
  speedPriority?: number; // 0-1
  /**
   * How much to prioritize intelligence and capabilities when selecting a model.
   */
  intelligencePriority?: number; // 0-1
  [key: string]: unknown;
}

/**
 * Describes a message issued to or received from an LLM API.
 */
export interface SamplingMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent | AudioContent;
  [key: string]: unknown;
}

/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
export interface CreateMessageRequest extends Request {
  method: "sampling/createMessage";
  params: BaseRequestParams & {
    messages: SamplingMessage[];
    /**
     * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
     */
    systemPrompt?: string;
    /**
     * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
     */
    includeContext?: "none" | "thisServer" | "allServers";
    temperature?: number;
    /**
     * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
     */
    maxTokens: number;
    stopSequences?: string[];
    /**
     * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
     */
    metadata?: { [key: string]: unknown };
    /**
     * The server's preferences for which model to select.
     */
    modelPreferences?: ModelPreferences;
  };
}

/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
export interface CreateMessageResult extends Result {
  /**
   * The name of the model that generated the message.
   */
  model: string;
  /**
   * The reason why sampling stopped.
   */
  stopReason?: "endTurn" | "stopSequence" | "maxTokens" | string;
  role: "user" | "assistant";
  content: TextContent | ImageContent | AudioContent;
}

/* Elicitation */
/**
 * Primitive schema definition for boolean fields.
 */
export interface BooleanSchema {
  type: "boolean";
  title?: string;
  description?: string;
  default?: boolean;
  [key: string]: unknown;
}

/**
 * Primitive schema definition for string fields.
 */
export interface StringSchema {
  type: "string";
  title?: string;
  description?: string;
  minLength?: number;
  maxLength?: number;
  format?: "email" | "uri" | "date" | "date-time";
  [key: string]: unknown;
}

/**
 * Primitive schema definition for number fields.
 */
export interface NumberSchema {
  type: "number" | "integer";
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

/**
 * Primitive schema definition for enum fields.
 */
export interface EnumSchema {
  type: "string";
  title?: string;
  description?: string;
  enum: string[];
  enumNames?: string[];
  [key: string]: unknown;
}

/**
 * Union of all primitive schema definitions.
 */
export type PrimitiveSchemaDefinition =
  | BooleanSchema
  | StringSchema
  | NumberSchema
  | EnumSchema;

/**
 * A request from the server to elicit user input via the client.
 * The client should present the message and form fields to the user.
 */
export interface ElicitRequest extends Request {
  method: "elicitation/create";
  params: BaseRequestParams & {
    /**
     * The message to present to the user.
     */
    message: string;
    /**
     * The schema for the requested user input.
     */
    requestedSchema: {
      type: "object";
      properties: Record<string, PrimitiveSchemaDefinition>;
      required?: string[];
      [key: string]: unknown;
    };
  };
}

/**
 * The client's response to an elicitation/create request from the server.
 */
export interface ElicitResult extends Result {
  /**
   * The user's response action.
   */
  action: "accept" | "decline" | "cancel";
  /**
   * The collected user input content (only present if action is "accept").
   */
  content?: Record<string, unknown>;
}

/* Autocomplete */
/**
 * A reference to a resource or resource template definition.
 */
export interface ResourceTemplateReference {
  type: "ref/resource";
  /**
   * The URI or URI template of the resource.
   */
  uri: string;
  [key: string]: unknown;
}

/**
 * Identifies a prompt.
 */
export interface PromptReference {
  type: "ref/prompt";
  /**
   * The name of the prompt or prompt template
   */
  name: string;
  [key: string]: unknown;
}

/**
 * A request from the client to the server, to ask for completion options.
 */
export interface CompleteRequest extends Request {
  method: "completion/complete";
  params: BaseRequestParams & {
    ref: PromptReference | ResourceTemplateReference;
    /**
     * The argument's information
     */
    argument: {
      /**
       * The name of the argument
       */
      name: string;
      /**
       * The value of the argument to use for completion matching.
       */
      value: string;
      [key: string]: unknown;
    };
    context?: {
      /**
       * Previously-resolved variables in a URI template or prompt.
       */
      arguments?: Record<string, string>;
    };
  };
}

/**
 * The server's response to a completion/complete request
 */
export interface CompleteResult extends Result {
  completion: {
    /**
     * An array of completion values. Must not exceed 100 items.
     */
    values: string[]; // max 100 items
    /**
     * The total number of completion options available. This can exceed the number of values actually sent in the response.
     */
    total?: number;
    /**
     * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
     */
    hasMore?: boolean;
    [key: string]: unknown;
  };
}

/* Roots */
/**
 * Represents a root directory or file that the server can operate on.
 */
export interface Root {
  /**
   * The URI identifying the root. This *must* start with file:// for now.
   */
  uri: string; // must start with "file://"
  /**
   * An optional name for the root.
   */
  name?: string;

  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Sent from the server to request a list of root URIs from the client.
 */
export interface ListRootsRequest extends Request {
  method: "roots/list";
}

/**
 * The client's response to a roots/list request from the server.
 */
export interface ListRootsResult extends Result {
  roots: Root[];
}

/**
 * A notification from the client to the server, informing it that the list of roots has changed.
 */
export interface RootsListChangedNotification extends Notification {
  method: "notifications/roots/list_changed";
}

/* Client messages */
export type ClientRequest =
  | PingRequest
  | InitializeRequest
  | CompleteRequest
  | SetLevelRequest
  | GetPromptRequest
  | ListPromptsRequest
  | ListResourcesRequest
  | ListResourceTemplatesRequest
  | ReadResourceRequest
  | SubscribeRequest
  | UnsubscribeRequest
  | CallToolRequest
  | ListToolsRequest;

export type ClientNotification =
  | CancelledNotification
  | ProgressNotification
  | InitializedNotification
  | RootsListChangedNotification;

export type ClientResult =
  | Result
  | CreateMessageResult
  | ElicitResult
  | ListRootsResult;

/* Server messages */
export type ServerRequest =
  | PingRequest
  | CreateMessageRequest
  | ElicitRequest
  | ListRootsRequest;

export type ServerNotification =
  | CancelledNotification
  | ProgressNotification
  | LoggingMessageNotification
  | ResourceUpdatedNotification
  | ResourceListChangedNotification
  | ToolListChangedNotification
  | PromptListChangedNotification;

export type ServerResult =
  | Result
  | InitializeResult
  | CompleteResult
  | GetPromptResult
  | ListPromptsResult
  | ListResourcesResult
  | ListResourceTemplatesResult
  | ReadResourceResult
  | CallToolResult
  | ListToolsResult;

export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(`MCP error ${code}: ${message}`);
    this.name = "McpError";
  }
}

// Utility types removed - now using direct TypeScript interfaces

/**
 * Headers that are compatible with both Node.js and the browser.
 */
export type IsomorphicHeaders = Record<string, string | string[] | undefined>;

/**
 * Information about the incoming request.
 */
export interface RequestInfo {
  /**
   * The headers of the request.
   */
  headers: IsomorphicHeaders;
}

/**
 * Extra information about a message.
 */
export interface MessageExtraInfo {
  /**
   * The request information.
   */
  requestInfo?: RequestInfo;

  /**
   * The authentication information.
   */
  authInfo?: AuthInfo;
}
