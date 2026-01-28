import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ManifestValidationError,
  manifestValidator,
  ManifestValidator,
} from "../validation/manifestValidator";
import { Manifest } from "../types";

describe("ManifestValidator", () => {
  let validator: ManifestValidator;

  beforeEach(() => {
    validator = new ManifestValidator();
  });

  describe("Valid Manifests", () => {
    it("validates minimal valid manifest", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "TestApp",
          description: "A test application for Aument validation",
        },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates manifest with single capability", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "TodoApp",
          description: "Simple todo application",
        },
        capabilities: {
          addTodo: {
            id: "addTodo",
            displayName: "Add Todo",
            description: "Create a new todo item with text and priority level",
            parameters: [],
            handler: {
              name: "Add Todo Handler",
              handlerRef: "todo.add",
            },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates manifest with all optional top-level fields", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "ComplexApp",
          description: "Application with all optional features",
          author: "Test Author",
        },
        definitions: {
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
          },
        },
        context: {
          user: { isLoggedIn: false },
          cart: { items: [] },
        },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates capability with all optional fields", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "App",
          description: "Test application",
        },
        capabilities: {
          placeOrder: {
            id: "placeOrder",
            displayName: "Place Order",
            description:
              "Submit order with delivery details and payment information",
            examples: ["Place order for 6pm", "Order with $5 tip"],
            category: "orders",
            parameters: [],
            handler: {
              name: "Place Order Handler",
              handlerRef: "order.place",
            },
            preconditions: [
              {
                type: "state",
                checker: {
                  name: "Cart Has Items",
                  handlerRef: "validators.cartHasItems",
                },
                description: "Cart must contain at least one item",
                errorMessage: "Your cart is empty",
              },
            ],
            sideEffects: [
              {
                name: "cart",
                properties: { cleared: true },
              },
              {
                name: "orders",
                properties: { created: true },
              },
            ],
            requiresConfirmation: true,
            isAsync: true,
            undoHandler: {
              name: "Cancel Order Handler",
              handlerRef: "order.cancel",
            },
            undoParameters: [],
            undoPreconditions: [],
            undoSideEffects: [],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates parameter with all fields", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "App",
          description: "Test application",
        },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with comprehensive parameters",
            parameters: [
              {
                name: "email",
                description: "User email address for notifications",
                type: "string",
                isRequired: true,
                validator: {
                  pattern: "^[^@]+@[^@]+\\.[^@]+$",
                  min: 5,
                  max: 100,
                },
                defaultValue: "user@example.com",
                examples: ["test@example.com", "user@domain.org"],
                isSensitive: false,
                collectionApproach: "upfront",
              },
              {
                name: "priority",
                description: "Task priority level selection",
                type: "enum",
                isRequired: false,
                validator: {
                  enum: [
                    { value: "low", label: "Low Priority" },
                    { value: "medium", label: "Medium Priority" },
                    { value: "high", label: "High Priority" },
                  ],
                },
              },
              {
                name: "cvv",
                description: "Credit card CVV code for payment",
                type: "string",
                isRequired: true,
                validator: {
                  pattern: "^\\d{3}$",
                  custom: {
                    name: "CVV Validator",
                    handlerRef: "validators.cvv",
                  },
                  isAsync: true,
                },
                isSensitive: true,
                collectionApproach: "on-demand",
              },
            ],
            handler: {
              name: "Test Handler",
              handlerRef: "test.handler",
            },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates all parameter types", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "TypeTest",
          description: "Test all parameter types",
        },
        capabilities: {
          testTypes: {
            id: "testTypes",
            displayName: "Test Types",
            description: "Capability testing all parameter type variations",
            parameters: [
              {
                name: "str",
                description: "String parameter",
                type: "string",
                isRequired: true,
              },
              {
                name: "num",
                description: "Number parameter",
                type: "number",
                isRequired: true,
              },
              {
                name: "bool",
                description: "Boolean parameter",
                type: "boolean",
                isRequired: true,
              },
              {
                name: "enm",
                description: "Enum parameter",
                type: "enum",
                isRequired: true,
              },
              {
                name: "obj",
                description: "Object parameter",
                type: "object",
                isRequired: true,
              },
              {
                name: "arr",
                description: "Array parameter",
                type: "array",
                isRequired: true,
              },
              {
                name: "file",
                description: "File parameter",
                type: "file",
                isRequired: true,
              },
              {
                name: "date",
                description: "Date parameter",
                type: "date",
                isRequired: true,
              },
              {
                name: "time",
                description: "Time parameter",
                type: "time",
                isRequired: true,
              },
              {
                name: "datetime",
                description: "Datetime parameter",
                type: "datetime",
                isRequired: true,
              },
              {
                name: "any",
                description: "Any type parameter",
                type: "any",
                isRequired: true,
              },
            ],
            handler: {
              name: "Type Test Handler",
              handlerRef: "test.types",
            },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates all precondition types", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "PreconditionTest",
          description: "Test all precondition types",
        },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with all precondition types",
            parameters: [],
            handler: {
              name: "Test Handler",
              handlerRef: "test.handler",
            },
            preconditions: [
              {
                type: "state",
                checker: { name: "State Check", handlerRef: "check.state" },
                description: "State check",
                errorMessage: "State invalid",
              },
              {
                type: "permission",
                checker: {
                  name: "Permission Check",
                  handlerRef: "check.permission",
                },
                description: "Permission check",
                errorMessage: "Permission denied",
              },
              {
                type: "rateLimit",
                checker: {
                  name: "Rate Limit Check",
                  handlerRef: "check.rateLimit",
                },
                description: "Rate limit check",
                errorMessage: "Rate limit exceeded",
                isAsync: true,
              },
              {
                type: "custom",
                checker: { name: "Custom Check", handlerRef: "check.custom" },
                description: "Custom check",
                errorMessage: "Custom check failed",
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });

    it("validates multiple capabilities", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "MultiCapApp",
          description: "App with multiple capabilities",
        },
        capabilities: {
          addToCart: {
            id: "addToCart",
            displayName: "Add to Cart",
            description: "Add item to shopping cart with quantity",
            parameters: [],
            handler: { name: "Add Handler", handlerRef: "cart.add" },
          },
          removeFromCart: {
            id: "removeFromCart",
            displayName: "Remove from Cart",
            description: "Remove item from shopping cart by ID",
            parameters: [],
            handler: { name: "Remove Handler", handlerRef: "cart.remove" },
          },
          checkout: {
            id: "checkout",
            displayName: "Checkout",
            description: "Complete checkout process with payment",
            parameters: [],
            handler: { name: "Checkout Handler", handlerRef: "order.checkout" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(true);
      expect(validator.getErrors()).toHaveLength(0);
    });
  });

  describe("Missing Required Fields", () => {
    it("rejects non-object manifest", () => {
      expect(validator.validate(null)).toBe(false);
      expect(validator.getErrors()[0]!.path).toBe("root");

      expect(validator.validate([])).toBe(false);
      expect(validator.validate("string")).toBe(false);
      expect(validator.validate(123)).toBe(false);
      expect(validator.validate(undefined)).toBe(false);
    });

    it("rejects manifest without $schema", () => {
      const manifest = {
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "$schema")).toBe(
        true
      );
    });

    it("rejects manifest without version", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "version")).toBe(
        true
      );
    });

    it("rejects manifest without metadata", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "metadata")).toBe(
        true
      );
    });

    it("rejects manifest without capabilities", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "capabilities")).toBe(
        true
      );
    });

    it("rejects metadata without name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          description: "Test application",
        },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "metadata.name")
      ).toBe(true);
    });

    it("rejects metadata without description", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "Test",
        },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "metadata.description")
      ).toBe(true);
    });

    it("rejects capability without id", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            displayName: "Test",
            description: "Test capability without id field",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "capabilities.test.id")
      ).toBe(true);
    });

    it("rejects capability without displayName", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            description: "Test capability without displayName",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.displayName")
      ).toBe(true);
    });

    it("rejects capability without description", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.description")
      ).toBe(true);
    });

    it("rejects capability without parameters", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability without parameters",
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.parameters")
      ).toBe(true);
    });

    it("rejects capability without handler", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability without handler",
            parameters: [],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler")
      ).toBe(true);
    });

    it("rejects parameter without name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid parameter",
            parameters: [
              {
                description: "Parameter without name",
                type: "string",
                isRequired: true,
              },
            ],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("parameters[0].name"))
      ).toBe(true);
    });

    it("rejects parameter without type", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid parameter",
            parameters: [
              {
                name: "param",
                description: "Parameter without type",
                isRequired: true,
              },
            ],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("parameters[0].type"))
      ).toBe(true);
    });

    it("rejects parameter without isRequired", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid parameter",
            parameters: [
              {
                name: "param",
                description: "Parameter without isRequired",
                type: "string",
              },
            ],
            handler: { name: "Test", handlerRef: "test.handler" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("parameters[0].isRequired"))
      ).toBe(true);
    });

    it("rejects handler without name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid handler",
            parameters: [],
            handler: {
              handlerRef: "test.handler",
            },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler.name")
      ).toBe(true);
    });

    it("rejects handler without handlerRef", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid handler",
            parameters: [],
            handler: {
              name: "Test Handler",
            },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler.handlerRef")
      ).toBe(true);
    });

    it("rejects precondition without required fields", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid precondition",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
            preconditions: [
              {
                type: "state",
                // Missing: checker, description, errorMessage
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const errors = validator.getErrors();
      expect(
        errors.some((e) => e.path.includes("preconditions[0].checker"))
      ).toBe(true);
      expect(
        errors.some((e) => e.path.includes("preconditions[0].description"))
      ).toBe(true);
      expect(
        errors.some((e) => e.path.includes("preconditions[0].errorMessage"))
      ).toBe(true);
    });

    it("rejects entity without name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid side effect",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
            sideEffects: [
              {
                properties: {},
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("sideEffects[0].name"))
      ).toBe(true);
    });

    it("rejects entity without properties", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability with invalid side effect",
            parameters: [],
            handler: { name: "Test", handlerRef: "test.handler" },
            sideEffects: [
              {
                name: "cart",
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("sideEffects[0].properties"))
      ).toBe(true);
    });
  });

  describe("Invalid Types", () => {
    it("rejects non-string $schema", () => {
      const manifest = {
        $schema: 123,
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "$schema")).toBe(
        true
      );
    });

    it("rejects wrong $schema value", () => {
      const manifest = {
        $schema: "https://wrong.schema.com",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator.getErrors().find((e) => e.path === "$schema");
      expect(error?.message).toContain("https://aument.dev/schema/v1");
    });

    it("rejects invalid version format", () => {
      const invalidVersions = ["v1", "1.0", "1", "latest", "1.0.0.0", "abc"];

      invalidVersions.forEach((version) => {
        validator.clearErrors();
        const manifest = {
          $schema: "https://aument.dev/schema/v1",
          version,
          metadata: { name: "Test", description: "Test application" },
          capabilities: {},
        };

        expect(validator.validate(manifest)).toBe(false);
        expect(validator.getErrors().some((e) => e.path === "version")).toBe(
          true
        );
      });
    });

    it("accepts valid semver versions", () => {
      const validVersions = ["0.0.1", "1.0.0", "12.34.56", "999.999.999"];

      validVersions.forEach((version) => {
        validator.clearErrors();
        const manifest = {
          $schema: "https://aument.dev/schema/v1",
          version,
          metadata: { name: "Test", description: "Test application" },
          capabilities: {},
        };

        expect(validator.validate(manifest)).toBe(true);
      });
    });

    it("rejects non-object metadata", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: "string",
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "metadata")).toBe(
        true
      );
    });

    it("rejects non-object capabilities", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: [],
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "capabilities")).toBe(
        true
      );
    });

    it("rejects empty metadata name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "", description: "Test application" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "metadata.name")
      ).toBe(true);
    });

    it("rejects short metadata description", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Short" },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path === "metadata.description");
      expect(error?.message).toContain("10 characters");
    });

    it("rejects non-string metadata author", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "Test",
          description: "Test application",
          author: 123,
        },
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "metadata.author")
      ).toBe(true);
    });

    it("rejects non-object definitions", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        definitions: "string",
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "definitions")).toBe(
        true
      );
    });

    it("rejects non-object context", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        context: [],
        capabilities: {},
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(validator.getErrors().some((e) => e.path === "context")).toBe(
        true
      );
    });

    it("rejects invalid capability ID format", () => {
      const invalidIds = [
        "123invalid",
        "invalid-id",
        "invalid.id",
        "invalid id",
        "",
      ];

      invalidIds.forEach((id) => {
        validator.clearErrors();
        const manifest = {
          $schema: "https://aument.dev/schema/v1",
          version: "1.0.0",
          metadata: { name: "Test", description: "Test application" },
          capabilities: {
            [id]: {
              id,
              displayName: "Test",
              description: "",
              parameters: [],
              handler: { name: "Test", handlerRef: "test" },
            },
          },
        };
        expect(validator.validate(manifest)).toBe(false);
      });
    });

    it("accepts valid capability ID formats", () => {
      const validIds = ["validId", "valid_id", "ValidId", "valid123", "v"];

      validIds.forEach((id) => {
        validator.clearErrors();
        const manifest = {
          $schema: "https://aument.dev/schema/v1",
          version: "1.0.0",
          metadata: { name: "Test", description: "Test application" },
          capabilities: {
            [id]: {
              id,
              displayName: "Test",
              description: "Test capability description",
              parameters: [],
              handler: { name: "Test", handlerRef: "test" },
            },
          },
        };

        expect(validator.validate(manifest)).toBe(true);
      });
    });

    it("rejects non-object capability", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: "string",
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path === "capabilities.test")
      ).toBe(true);
    });

    it("rejects empty capability displayName", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.displayName")
      ).toBe(true);
    });

    it("rejects short capability description", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Short",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path === "capabilities.test.description");
      expect(error?.message).toContain("20 characters");
    });

    it("rejects non-array parameters", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: {},
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.parameters")
      ).toBe(true);
    });

    it("rejects non-object handler", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: "string",
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler")
      ).toBe(true);
    });

    it("rejects empty handler name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler.name")
      ).toBe(true);
    });

    it("rejects empty handler handlerRef", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.handler.handlerRef")
      ).toBe(true);
    });

    it("rejects invalid parameter type", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "invalid-type",
                isRequired: true,
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path.includes("parameters[0].type"));
      expect(error?.message).toContain("Must be one of");
    });

    it("rejects short parameter description", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Short",
                type: "string",
                isRequired: true,
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path.includes("parameters[0].description"));
      expect(error?.message).toContain("10 characters");
    });

    it("rejects non-boolean isRequired", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: "true",
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("parameters[0].isRequired"))
      ).toBe(true);
    });

    it("rejects non-array examples in parameter", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                examples: "not-an-array",
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("parameters[0].examples"))
      ).toBe(true);
    });

    it("rejects invalid collectionApproach", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                collectionApproach: "invalid",
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path.includes("parameters[0].collectionApproach"));
      expect(error?.message).toContain("upfront");
      expect(error?.message).toContain("on-demand");
    });

    it("rejects invalid precondition type", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
            preconditions: [
              {
                type: "invalid",
                checker: { name: "Check", handlerRef: "check" },
                description: "Test",
                errorMessage: "Error",
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const error = validator
        .getErrors()
        .find((e) => e.path.includes("preconditions[0].type"));
      expect(error?.message).toContain("Must be one of");
    });

    it("rejects non-array examples in capability", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            examples: "not-an-array",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.examples")
      ).toBe(true);
    });

    it("rejects non-string examples in capability examples array", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            examples: [123, true],
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      const errors = validator.getErrors();
      expect(
        errors.some((e) => e.path === "capabilities.test.examples[0]")
      ).toBe(true);
      expect(
        errors.some((e) => e.path === "capabilities.test.examples[1]")
      ).toBe(true);
    });

    it("rejects non-boolean requiresConfirmation", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
            requiresConfirmation: "true",
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.requiresConfirmation")
      ).toBe(true);
    });

    it("rejects non-boolean isAsync in capability", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
            isAsync: 1,
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path === "capabilities.test.isAsync")
      ).toBe(true);
    });

    it("rejects non-object validator", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                validator: "string",
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("validator"))
      ).toBe(true);
    });

    it("rejects non-number min in validator", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                validator: { min: "5" },
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("validator.min"))
      ).toBe(true);
    });

    it("rejects non-string pattern in validator", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                validator: { pattern: 123 },
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("validator.pattern"))
      ).toBe(true);
    });

    it("rejects non-array enum in validator", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "string",
                isRequired: true,
                validator: { enum: "not-array" },
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator.getErrors().some((e) => e.path.includes("validator.enum"))
      ).toBe(true);
    });

    it("rejects enum items without value or label", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [
              {
                name: "param",
                description: "Test parameter",
                type: "enum",
                isRequired: true,
                validator: {
                  enum: [
                    { value: "test" }, // Missing label
                  ],
                },
              },
            ],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("validator.enum[0].label"))
      ).toBe(true);
    });

    it("rejects empty entity name", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Test capability description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
            sideEffects: [
              {
                name: "",
                properties: {},
              },
            ],
          },
        },
      };

      expect(validator.validate(manifest)).toBe(false);
      expect(
        validator
          .getErrors()
          .some((e) => e.path.includes("sideEffects[0].name"))
      ).toBe(true);
    });
  });

  describe("Semantic Validation", () => {
    it("validates undo handler exists", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          add: {
            id: "add",
            displayName: "Add",
            description: "Add capability with valid undo",
            parameters: [],
            handler: { name: "Add", handlerRef: "add.handler" },
            undoHandler: { name: "Remove", handlerRef: "remove.handler" },
          },
          remove: {
            id: "remove",
            displayName: "Remove",
            description: "Remove capability description",
            parameters: [],
            handler: { name: "Remove", handlerRef: "remove.handler" },
          },
        },
      };
      expect(() => validator.validateSemantics(manifest)).not.toThrow();
    });

    it("rejects undo handler that does not exist", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          add: {
            id: "add",
            displayName: "Add",
            description: "Add capability with invalid undo",
            parameters: [],
            handler: { name: "Add", handlerRef: "add.handler" },
            undoHandler: {
              name: "Nonexistent",
              handlerRef: "nonexistent.handler",
            },
          },
        },
      };

      expect(() => validator.validateSemantics(manifest)).toThrow(
        ManifestValidationError
      );
      expect(() => validator.validateSemantics(manifest)).toThrow(/not found/);
    });

    it("validates multiple undo handlers", () => {
      const manifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {
          add: {
            id: "add",
            displayName: "Add",
            description: "Add capability description",
            parameters: [],
            handler: { name: "Add", handlerRef: "add.handler" },
            undoHandler: { name: "Remove", handlerRef: "remove.handler" },
          },
          update: {
            id: "update",
            displayName: "Update",
            description: "Update capability description",
            parameters: [],
            handler: { name: "Update", handlerRef: "update.handler" },
            undoHandler: { name: "Revert", handlerRef: "revert.handler" },
          },
          remove: {
            id: "remove",
            displayName: "Remove",
            description: "Remove capability description",
            parameters: [],
            handler: { name: "Remove", handlerRef: "remove.handler" },
          },
          revert: {
            id: "revert",
            displayName: "Revert",
            description: "Revert capability description",
            parameters: [],
            handler: { name: "Revert", handlerRef: "revert.handler" },
          },
        },
      };

      expect(() => validator.validateSemantics(manifest)).not.toThrow();
    });
  });
  describe("Validation Methods", () => {
    const validManifest: Manifest = {
      $schema: "https://aument.dev/schema/v1",
      version: "1.0.0",
      metadata: {
        name: "Test",
        description: "Test application",
      },
      capabilities: {},
    };
    const invalidManifest = {
      $schema: "wrong",
      version: "invalid",
    };

    it("validate() returns boolean", () => {
      expect(validator.validate(validManifest)).toBe(true);
      expect(validator.validate(invalidManifest)).toBe(false);
    });

    it("validateWithErrors() returns detailed results", () => {
      const result = validator.validateWithErrors(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toBeInstanceOf(ManifestValidationError);
    });

    it("validateOrThrow() throws on invalid manifest", () => {
      expect(() => validator.validateOrThrow(validManifest)).not.toThrow();
      expect(() => validator.validateOrThrow(invalidManifest)).toThrow(
        ManifestValidationError
      );
    });

    it("getErrors() returns all errors", () => {
      validator.validate(invalidManifest);
      const errors = validator.getErrors();

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toBeInstanceOf(ManifestValidationError);
    });

    it("clearErrors() clears error list", () => {
      validator.validate(invalidManifest);
      expect(validator.getErrors().length).toBeGreaterThan(0);

      validator.clearErrors();
      expect(validator.getErrors().length).toBe(0);
    });

    it("errors accumulate across fields", () => {
      const multipleErrors = {
        // Missing everything
      };

      validator.validate(multipleErrors);
      const errors = validator.getErrors();

      expect(errors.length).toBeGreaterThan(3);
      expect(errors.some((e) => e.path === "$schema")).toBe(true);
      expect(errors.some((e) => e.path === "version")).toBe(true);
      expect(errors.some((e) => e.path === "metadata")).toBe(true);
      expect(errors.some((e) => e.path === "capabilities")).toBe(true);
    });
  });
  describe("Error Messages", () => {
    it("includes path in error message", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Short" },
        capabilities: {},
      };
      validator.validate(manifest);
      const error = validator.getErrors()[0];

      expect(error!.message).toContain("metadata.description");
    });

    it("includes helpful context in messages", () => {
      const manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: {
          name: "Test",
          description: "short des",
        },
        capabilities: {
          test: {
            id: "test",
            displayName: "Test",
            description: "Short description",
            parameters: [],
            handler: { name: "Test", handlerRef: "test" },
          },
        },
      };

      validator.validate(manifest);
      const error = validator
        .getErrors()
        .find((e) => e.path.includes("description"));

      expect(error?.message).toContain(
        "metadata.description: Must be at least 10 characters, got 9"
      );
    });

    it("error has correct structure", () => {
      validator.validate({});
      const error = validator.getErrors()[0];

      expect(error).toHaveProperty("name");
      expect(error).toHaveProperty("message");
      expect(error).toHaveProperty("path");
      expect(error!.name).toBe("ManifestValidationError");
    });
  });
  describe("Singleton Instance", () => {
    it("manifestValidator is exported", () => {
      expect(manifestValidator).toBeInstanceOf(ManifestValidator);
    });
    it("singleton works correctly", () => {
      const validManifest: Manifest = {
        $schema: "https://aument.dev/schema/v1",
        version: "1.0.0",
        metadata: { name: "Test", description: "Test application" },
        capabilities: {},
      };

      expect(manifestValidator.validate(validManifest)).toBe(true);
    });
  });
});
