import { Parameter, Validator } from "../../schema/types";
import { match, _ } from "matchixir";

export type ParameterValidationResult = {
    isValid: boolean;
    errors: string[];
};

export class ParameterValidator {
    validate(
        paramDef: Parameter,
        value: unknown
    ): ParameterValidationResult {
        const errors: string[] = [];

        if (paramDef.isRequired && (value === undefined || value === null)) {
            errors.push(`Parameter "${paramDef.name}" is required`);
            return { isValid: false, errors };
        }

        if (!paramDef.isRequired && (value === undefined || value === null)) {
            return { isValid: true, errors: [] };
        }

        const typeError = this.validateType(paramDef.type, value);
        if (typeError) {
            errors.push(typeError);
        }

        if (paramDef.validator && errors.length === 0) {
            const constraintErrors = this.validateConstraints(paramDef.validator, value);
            errors.push(...constraintErrors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateAll(
        paramDefs: Parameter[],
        providedParams: Record<string, unknown>
    ): ParameterValidationResult {
        const allErrors: string[] = [];

        for (const paramDef of paramDefs) {
            const value = providedParams[paramDef.name];
            const result = this.validate(paramDef, value);
            allErrors.push(...result.errors);
        }

        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }

    private validateType(type: string, value: unknown): string | null {
        return match(type)
            .with("string", () => typeof value === "string" ? null : "Must be a string")
            .with("number", () => typeof value === "number" ? null : "Must be a number")
            .with("boolean", () => typeof value === "boolean" ? null : "Must be a boolean")
            .with("array", () => Array.isArray(value) ? null : "Must be an array")
            .with("object", () =>
                typeof value === "object" && value !== null && !Array.isArray(value)
                    ? null
                    : "Must be an object"
            )
            .with("enum", () => null)
            .when(
                t => t === "date" || t === "time" || t === "datetime",
                () => this.validateDateType(value)
            )
            .with("any", () => null)
            .none(() => `Unknown type: ${type}`);
    }


    private validateDateType(value: unknown): string | null {
        if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? 'Invalid date format' : null;
        }
        if (value instanceof Date) {
            return null;
        }
        return 'Must be a date string or Date object';
    }

    private validateConstraints(validator: Validator, value: unknown): string[] {
        const errors: string[] = [];

        if (validator.min !== undefined && typeof value === 'number') {
            if (value < validator.min) {
                errors.push(`Must be at least ${validator.min}`);
            }
        }

        if (validator.max !== undefined && typeof value === 'number') {
            if (value > validator.max) {
                errors.push(`Must be at most ${validator.max}`);
            }
        }

        if (validator.min !== undefined && typeof value === 'string') {
            if (value.length < validator.min) {
                errors.push(`Must be at least ${validator.min} characters`);
            }
        }

        if (validator.max !== undefined && typeof value === 'string') {
            if (value.length > validator.max) {
                errors.push(`Must be at most ${validator.max} characters`);
            }
        }

        if (validator.pattern && typeof value === 'string') {
            const regex = new RegExp(validator.pattern);
            if (!regex.test(value)) {
                errors.push(`Does not match required pattern`);
            }
        }

        if (validator.enum && Array.isArray(validator.enum)) {
            const validValues = validator.enum.map(e => e.value);
            if (!validValues.includes(value as string)) {
                errors.push(`Must be one of: ${validValues.join(', ')}`);
            }
        }

        return errors;
    }

    isEmail(value: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    isURL(value: string): boolean {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    isUUID(value: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    }

    isPhoneNumber(value: string): boolean {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(value.replace(/[\s()-]/g, ''));
    }

    isAge(value: number): boolean {
        return Number.isInteger(value) && value >= 0 && value <= 130;
    }

    isCountryCode(value: string): boolean {
        // ISO 3166-1 alpha-2
        return /^[A-Z]{2}$/.test(value);
    }

    isPrice(value: number): boolean {
        return typeof value === "number" && value >= 0 && Number.isFinite(value);
    }

    isPercentage(value: number): boolean {
        return typeof value === "number" && value >= 0 && value <= 100;
    }

    isPositiveNumber(value: number): boolean {
        return typeof value === "number" && value > 0;
    }

    isHexColor(value: string): boolean {
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
    }

    isBase64(value: string): boolean {
        return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
    }

    isIPv4(value: string): boolean {
        return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/.test(value);
    }
}