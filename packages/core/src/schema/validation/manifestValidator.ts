import type { Capability, Manifest } from "../types";

export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public path: string,
    public details?: unknown
  ) {
    super(`${path}: ${message}`);
    this.name = "ManifestValidationError";
  }
}

interface ValidationResult {
  valid: boolean;
  errors: ManifestValidationError[];
}

export class ManifestValidator {
  private errors: ManifestValidationError[] = [];
  private capabilities: Set<string> = new Set();
  private undoCapabilities: Set<string> = new Set();

  validate(data: unknown): data is Manifest {
    this.errors = [];
    this.capabilities = new Set();
    this.undoCapabilities = new Set();

    if (!this.isObject(data)) {
      this.addError("root", "Manifest must be an object");
      return false;
    }

    this.validateRequiredField(data, "$schema", "string");
    this.validateRequiredField(data, "version", "string");
    this.validateRequiredField(data, "metadata", "object");
    this.validateRequiredField(data, "capabilities", "object");

    if (typeof data.$schema === "string") {
      this.validateSchema(data.$schema);
    }

    if (typeof data.version === "string") {
      this.validateVersion(data.version);
    }

    if (this.isObject(data.metadata)) {
      this.validateMetadata(data.metadata);
    }

    if (this.isObject(data.capabilities)) {
      this.validateCapabilities(data, data.capabilities);
    }

    if (data.definitions !== undefined) {
      if (!this.isObject(data.definitions)) {
        this.addError("definitions", "Must be an object");
      }
    }

    if (data.context !== undefined) {
      if (!this.isObject(data.context)) {
        this.addError("context", "Must be an object");
      }
    }

    const isSubset = (setA: Set<string>, setB: Set<string>) =>
      [...setB].every(el => setA.has(el));

    if (!isSubset(this.capabilities, this.undoCapabilities)) {
      this.addError("undoCapabilities", "Some undo capabilities are missing");
    }

    return this.errors.length === 0;
  }

  validateWithErrors(data: unknown): ValidationResult {
    const valid = this.validate(data);
    return {
      valid,
      errors: [...this.errors],
    };
  }

  validateOrThrow(data: unknown): asserts data is Manifest {
    if (!this.validate(data)) {
      throw (
        this.errors[0] ||
        new ManifestValidationError("root", "Validation failed")
      );
    }
  }

  private getHandlerRef(capabilities: Record<string, Capability>, capId: string): string {
    return Object.values(capabilities)
      .filter((cap) => cap.id === capId)
      .map((cap) => cap.handler.handlerRef)[0] || "";
  }

  private getCapability(manifest: Record<string, unknown>, capId: string): Capability | null {
    return Object.values((manifest as unknown as Manifest).capabilities).find((cap) => cap.id === capId) || null;
  }

  // private getCapabilityAsRecord(manifest: Record<string, unknown>, capId: string): Record<string, unknown> {
  //   const obj: Record<string, unknown> = {
  //     [capId]: this.getCapability(manifest, capId),
  //   };
  //   return obj;
  // }

  validateSemantics(manifest: Manifest): void {
    this.errors = [];

    const handlers = new Set<string>();
    const undoHandlers = new Map<string, string>(); // capability -> undo handler

    for (const [capId, capability] of Object.entries(manifest.capabilities)) {
      const handlerRef = capability.handler.handlerRef;

      // Check for duplicate handlers (might be intentional)
      handlers.add(handlerRef);

      if (capability.undoCapabilityId) {
        undoHandlers.set(capId, this.getHandlerRef(manifest.capabilities, capability.undoCapabilityId));
      }
    }

    for (const [capId, undoRef] of undoHandlers.entries()) {
      if (!handlers.has(undoRef)) {
        this.addError(
          `capabilities.${capId}.undoCapabilityId`,
          `Undo handler "${undoRef}" not found in any capability`
        );
      }
    }

    // TODO: Validate category references (if using categories)

    if (this.errors.length > 0) {
      throw this.errors[0];
    }
  }

  private validateSchema(schema: string): void {
    const expectedSchema = "https://aument.dev/schema/v1";
    if (schema !== expectedSchema) {
      this.addError("$schema", `Must be "${expectedSchema}", got "${schema}"`);
    }
  }

  private validateVersion(version: string): void {
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(version)) {
      this.addError(
        "version",
        `Must be valid semver (e.g., "1.0.0"), got "${version}"`
      );
    }
  }

  private validateMetadata(metadata: Record<string, unknown>): void {
    this.validateRequiredField(metadata, "name", "string", "metadata");
    this.validateRequiredField(metadata, "description", "string", "metadata");

    if (typeof metadata.name === "string" && metadata.name.length === 0) {
      this.addError("metadata.name", "Must not be empty");
    }

    if (
      typeof metadata.description === "string" &&
      metadata.description.length < 10
    ) {
      this.addError(
        "metadata.description",
        `Must be at least 10 characters, got ${metadata.description.length}"`
      );
    }

    if (metadata.author !== undefined && typeof metadata.author !== "string") {
      this.addError("metadata.author", "Must be a string if provided");
    }
  }

  private validateCapabilities(manifest: Record<string, unknown>, capabilities: Record<string, unknown>): void {
    const capabilityNames = Object.keys(capabilities);

    if (capabilityNames.length === 0) {
      return;
    }

    for (const [capId, capability] of Object.entries(capabilities)) {
      const path = `capabilities.${capId}`;

      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(capId)) {
        this.addError(
          path,
          "Capability ID must start with letter and contain only alphanumeric and underscore"
        );
      }

      if (!this.isObject(capability)) {
        this.addError(path, "Must be an object");
        continue;
      }

      this.validateCapability(manifest, capability, path);
    }
  }

  private validateCapability(
    manifest: Record<string, unknown>,
    capability: Record<string, unknown>,
    path: string
  ): void {
    this.validateRequiredField(capability, "id", "string", path);
    this.validateRequiredField(capability, "displayName", "string", path);
    this.validateRequiredField(capability, "description", "string", path);
    this.validateRequiredField(capability, "parameters", "array", path);
    this.validateRequiredField(capability, "handler", "object", path);

    if (
      typeof capability.displayName === "string" &&
      capability.displayName.length === 0
    ) {
      this.addError(`${path}.displayName`, "Must not be empty");
    }

    if (
      typeof capability.description === "string" &&
      capability.description.length < 20
    ) {
      this.addError(
        `${path}.description`,
        `Must be at least 20 characters, got ${capability.description.length}`
      );
    }

    if (this.isObject(capability.handler)) {
      this.validateHandler(capability.handler, `${path}.handler`);
    }

    if (Array.isArray(capability.parameters)) {
      this.validateParameters(capability.parameters, `${path}.parameters`);
    }

    if (capability.examples !== undefined) {
      if (!Array.isArray(capability.examples)) {
        this.addError(`${path}.examples`, "Must be an array");
      } else {
        capability.examples.forEach((example, i) => {
          if (typeof example !== "string") {
            this.addError(`${path}.examples[${i}]`, "Must be a string");
          }
        });
      }
    }

    if (capability.preconditions !== undefined) {
      if (!Array.isArray(capability.preconditions)) {
        this.addError(`${path}.preconditions`, "Must be an array");
      } else {
        this.validatePreconditions(
          capability.preconditions,
          `${path}.preconditions`
        );
      }
    }

    if (capability.sideEffects !== undefined) {
      if (!Array.isArray(capability.sideEffects)) {
        this.addError(`${path}.sideEffects`, "Must be an array");
      } else {
        this.validateEntities(capability.sideEffects, `${path}.sideEffects`);
      }
    }

    if (
      capability.category !== undefined &&
      typeof capability.category !== "string"
    ) {
      this.addError(`${path}.category`, "Must be a string");
    }

    if (
      capability.requiresConfirmation !== undefined &&
      typeof capability.requiresConfirmation !== "boolean"
    ) {
      this.addError(`${path}.requiresConfirmation`, "Must be a boolean");
    }

    if (
      capability.isAsync !== undefined &&
      typeof capability.isAsync !== "boolean"
    ) {
      this.addError(`${path}.isAsync`, "Must be a boolean");
    }

    if (capability.undoCapabilityId !== undefined) {
      if (typeof capability.undoCapabilityId !== "string") {
        this.addError(`${path}.undoCapabilityId`, "Must be a string");
      } else {
        const undoCapability = this.getCapability(
          manifest,
          capability.undoCapabilityId);
        if (undoCapability === undefined || !this.isObject(undoCapability) || undoCapability === null) {
          this.addError(`${path}.undoCapabilityId`, `Undo capability ${capability.undoCapabilityId} not found`);
        }
        this.undoCapabilities.add(capability.undoCapabilityId);
      }
    }
    this.capabilities.add(capability.id as string);
  }

  private validateParameters(parameters: unknown[], path: string): void {
    parameters.forEach((param, i) => {
      const paramPath = `${path}[${i}]`;

      if (!this.isObject(param)) {
        this.addError(paramPath, "Must be an object");
        return;
      }

      this.validateParameter(param, paramPath);
    });
  }

  private validateParameter(
    param: Record<string, unknown>,
    path: string
  ): void {
    this.validateRequiredField(param, "name", "string", path);
    this.validateRequiredField(param, "description", "string", path);
    this.validateRequiredField(param, "type", "string", path);
    this.validateRequiredField(param, "isRequired", "boolean", path);

    if (
      typeof param.description === "string" &&
      param.description.length < 10
    ) {
      this.addError(
        `${path}.description`,
        `Must be at least 10 characters, got ${param.description.length}`
      );
    }

    if (typeof param.type === "string") {
      const validTypes = [
        "string",
        "number",
        "boolean",
        "enum",
        "object",
        "array",
        "file",
        "date",
        "time",
        "datetime",
        "any",
      ];
      if (!validTypes.includes(param.type)) {
        this.addError(
          `${path}.type`,
          `Must be one of: ${validTypes.join(", ")}, got "${param.type}"`
        );
      }
    }

    if (param.validator !== undefined) {
      if (!this.isObject(param.validator)) {
        this.addError(`${path}.validator`, "Must be an object");
      } else {
        this.validateValidator(param.validator, `${path}.validator`);
      }
    }

    if (param.examples !== undefined && !Array.isArray(param.examples)) {
      this.addError(`${path}.examples`, "Must be an array");
    }

    if (
      param.isSensitive !== undefined &&
      typeof param.isSensitive !== "boolean"
    ) {
      this.addError(`${path}.isSensitive`, "Must be a boolean");
    }

    if (param.collectionApproach !== undefined) {
      if (typeof param.collectionApproach !== "string") {
        this.addError(`${path}.collectionApproach`, "Must be a string");
      } else if (!["upfront", "on-demand"].includes(param.collectionApproach)) {
        this.addError(
          `${path}.collectionApproach`,
          'Must be "upfront" or "on-demand"'
        );
      }
    }
  }

  private validateValidator(
    validator: Record<string, unknown>,
    path: string
  ): void {
    if (validator.min !== undefined && typeof validator.min !== "number") {
      this.addError(`${path}.min`, "Must be a number");
    }

    if (validator.max !== undefined && typeof validator.max !== "number") {
      this.addError(`${path}.max`, "Must be a number");
    }

    if (
      validator.pattern !== undefined &&
      typeof validator.pattern !== "string"
    ) {
      this.addError(`${path}.pattern`, "Must be a string (regex pattern)");
    }

    if (validator.enum !== undefined) {
      if (!Array.isArray(validator.enum)) {
        this.addError(`${path}.enum`, "Must be an array");
      } else {
        validator.enum.forEach((item, i) => {
          if (!this.isObject(item)) {
            this.addError(`${path}.enum[${i}]`, "Must be an object");
            return;
          }

          this.validateRequiredField(
            item,
            "value",
            "string",
            `${path}.enum[${i}]`
          );
          this.validateRequiredField(
            item,
            "label",
            "string",
            `${path}.enum[${i}]`
          );
        });
      }
    }

    if (validator.custom !== undefined) {
      if (!this.isObject(validator.custom)) {
        this.addError(`${path}.custom`, "Must be an object (Handler)");
      } else {
        this.validateHandler(validator.custom, `${path}.custom`);
      }
    }

    if (
      validator.isAsync !== undefined &&
      typeof validator.isAsync !== "boolean"
    ) {
      this.addError(`${path}.isAsync`, "Must be a boolean");
    }
  }

  private validatePreconditions(preconditions: unknown[], path: string): void {
    preconditions.forEach((precondition, i) => {
      const precondPath = `${path}[${i}]`;

      if (!this.isObject(precondition)) {
        this.addError(precondPath, "Must be an object");
        return;
      }

      this.validatePrecondition(precondition, precondPath);
    });
  }

  private validatePrecondition(
    precondition: Record<string, unknown>,
    path: string
  ): void {
    this.validateRequiredField(precondition, "type", "string", path);
    this.validateRequiredField(precondition, "checker", "object", path);
    this.validateRequiredField(precondition, "description", "string", path);
    this.validateRequiredField(precondition, "errorMessage", "string", path);

    if (typeof precondition.type === "string") {
      const validTypes = ["state", "permission", "rateLimit", "custom"];
      if (!validTypes.includes(precondition.type)) {
        this.addError(
          `${path}.type`,
          `Must be one of: ${validTypes.join(", ")}, got "${precondition.type}"`
        );
      }
    }

    if (this.isObject(precondition.checker)) {
      this.validateHandler(precondition.checker, `${path}.checker`);
    }

    if (
      precondition.isAsync !== undefined &&
      typeof precondition.isAsync !== "boolean"
    ) {
      this.addError(`${path}.isAsync`, "Must be a boolean");
    }
  }

  private validateHandler(
    handler: Record<string, unknown>,
    path: string
  ): void {
    this.validateRequiredField(handler, "name", "string", path);
    this.validateRequiredField(handler, "handlerRef", "string", path);

    if (typeof handler.name === "string" && handler.name.length === 0) {
      this.addError(`${path}.name`, "Must not be empty");
    }

    if (
      typeof handler.handlerRef === "string" &&
      handler.handlerRef.length === 0
    ) {
      this.addError(`${path}.handlerRef`, "Must not be empty");
    }
  }

  private validateEntities(entities: unknown[], path: string): void {
    entities.forEach((entity, i) => {
      const entityPath = `${path}[${i}]`;

      if (!this.isObject(entity)) {
        this.addError(entityPath, "Must be an object");
        return;
      }

      this.validateEntity(entity, entityPath);
    });
  }

  private validateEntity(entity: Record<string, unknown>, path: string): void {
    this.validateRequiredField(entity, "name", "string", path);
    this.validateRequiredField(entity, "properties", "object", path);

    if (typeof entity.name === "string" && entity.name.length === 0) {
      this.addError(`${path}.name`, "Must not be empty");
    }
  }

  private validateRequiredField(
    obj: Record<string, unknown>,
    field: string,
    expectedType: "string" | "number" | "boolean" | "object" | "array",
    parentPath?: string
  ): void {
    const path = parentPath ? `${parentPath}.${field}` : field;
    const value = obj[field];

    if (value === undefined) {
      this.addError(path, "Required field is missing");
      return;
    }

    const actualType = Array.isArray(value) ? "array" : typeof value;

    if (actualType !== expectedType) {
      this.addError(path, `Expected ${expectedType}, got ${actualType}`);
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private addError(path: string, message: string, details?: unknown): void {
    this.errors.push(new ManifestValidationError(message, path, details));
  }

  getErrors(): ManifestValidationError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }
}

export const manifestValidator: ManifestValidator = new ManifestValidator();
