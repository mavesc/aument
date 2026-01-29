import { describe, it, expect, beforeEach } from '@jest/globals';
import { ParameterValidator } from '../validation/parameterValidator';
import type { Parameter } from '../../schema';

describe('ParameterValidator', () => {
    let validator: ParameterValidator;

    const createParam = (overrides?: Partial<Parameter>): Parameter => ({
        name: 'testParam',
        description: 'Test parameter for validation',
        type: 'string',
        isRequired: true,
        ...overrides
    });

    beforeEach(() => {
        validator = new ParameterValidator();
    });

    describe('Required Validation', () => {
        it('validates required parameter with value', () => {
            const param = createParam({ isRequired: true });
            const result = validator.validate(param, 'test value');

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejects required parameter without value', () => {
            const param = createParam({ isRequired: true });
            const result = validator.validate(param, undefined);

            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain('required');
        });

        it('rejects required parameter with null', () => {
            const param = createParam({ isRequired: true });
            const result = validator.validate(param, null);

            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain('required');
        });

        it('accepts optional parameter without value', () => {
            const param = createParam({ isRequired: false });
            const result = validator.validate(param, undefined);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('accepts optional parameter with null', () => {
            const param = createParam({ isRequired: false });
            const result = validator.validate(param, null);

            expect(result.isValid).toBe(true);
        });
    });

    describe('Type Validation', () => {
        it('validates string type', () => {
            const param = createParam({ type: 'string' });
            expect(validator.validate(param, 'text').isValid).toBe(true);
            expect(validator.validate(param, 123).isValid).toBe(false);
            expect(validator.validate(param, true).isValid).toBe(false);
        });

        it('validates number type', () => {
            const param = createParam({ type: 'number' });
            expect(validator.validate(param, 123).isValid).toBe(true);
            expect(validator.validate(param, 45.67).isValid).toBe(true);
            expect(validator.validate(param, '123').isValid).toBe(false);
            expect(validator.validate(param, true).isValid).toBe(false);
        });

        it('validates boolean type', () => {
            const param = createParam({ type: 'boolean' });
            expect(validator.validate(param, true).isValid).toBe(true);
            expect(validator.validate(param, false).isValid).toBe(true);
            expect(validator.validate(param, 'true').isValid).toBe(false);
            expect(validator.validate(param, 1).isValid).toBe(false);
        });

        it('validates array type', () => {
            const param = createParam({ type: 'array' });
            expect(validator.validate(param, []).isValid).toBe(true);
            expect(validator.validate(param, [1, 2, 3]).isValid).toBe(true);
            expect(validator.validate(param, {}).isValid).toBe(false);
            expect(validator.validate(param, 'array').isValid).toBe(false);
        });

        it('validates object type', () => {
            const param = createParam({ type: 'object' });
            expect(validator.validate(param, {}).isValid).toBe(true);
            expect(validator.validate(param, { key: 'value' }).isValid).toBe(true);
            expect(validator.validate(param, []).isValid).toBe(false);
            expect(validator.validate(param, null).isValid).toBe(false);
        });

        it('validates datetime type with string', () => {
            const param = createParam({ type: 'datetime' });
            expect(validator.validate(param, '2024-01-01').isValid).toBe(true);
            expect(validator.validate(param, '2024-01-01T12:00:00Z').isValid).toBe(true);
            expect(validator.validate(param, 'invalid-date').isValid).toBe(false);
        });

        it('validates datetime type with Date object', () => {
            const param = createParam({ type: 'datetime' });
            expect(validator.validate(param, new Date()).isValid).toBe(true);
        });

        it('accepts any type', () => {
            const param = createParam({ type: 'any' });
            expect(validator.validate(param, 'string').isValid).toBe(true);
            expect(validator.validate(param, 123).isValid).toBe(true);
            expect(validator.validate(param, true).isValid).toBe(true);
            expect(validator.validate(param, {}).isValid).toBe(true);
            expect(validator.validate(param, []).isValid).toBe(true);
        });
    });

    describe('Constraint Validation', () => {
        it('validates min constraint for numbers', () => {
            const param = createParam({
                type: 'number',
                validator: { min: 10 }
            });

            expect(validator.validate(param, 10).isValid).toBe(true);
            expect(validator.validate(param, 15).isValid).toBe(true);
            expect(validator.validate(param, 5).isValid).toBe(false);
        });

        it('validates max constraint for numbers', () => {
            const param = createParam({
                type: 'number',
                validator: { max: 100 }
            });

            expect(validator.validate(param, 100).isValid).toBe(true);
            expect(validator.validate(param, 50).isValid).toBe(true);
            expect(validator.validate(param, 150).isValid).toBe(false);
        });

        it('validates min and max together for numbers', () => {
            const param = createParam({
                type: 'number',
                validator: { min: 10, max: 100 }
            });

            expect(validator.validate(param, 50).isValid).toBe(true);
            expect(validator.validate(param, 5).isValid).toBe(false);
            expect(validator.validate(param, 150).isValid).toBe(false);
        });

        it('validates min length for strings', () => {
            const param = createParam({
                type: 'string',
                validator: { min: 5 }
            });

            expect(validator.validate(param, 'hello').isValid).toBe(true);
            expect(validator.validate(param, 'hello world').isValid).toBe(true);
            expect(validator.validate(param, 'hi').isValid).toBe(false);
        });

        it('validates max length for strings', () => {
            const param = createParam({
                type: 'string',
                validator: { max: 10 }
            });

            expect(validator.validate(param, 'short').isValid).toBe(true);
            expect(validator.validate(param, 'this is way too long').isValid).toBe(false);
        });

        it('validates pattern (regex) for strings', () => {
            const param = createParam({
                type: 'string',
                validator: { pattern: '^[a-z]+$' }
            });

            expect(validator.validate(param, 'abc').isValid).toBe(true);
            expect(validator.validate(param, 'ABC').isValid).toBe(false);
            expect(validator.validate(param, 'abc123').isValid).toBe(false);
        });

        it('validates enum values', () => {
            const param = createParam({
                type: 'enum',
                validator: {
                    enum: [
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High' }
                    ]
                }
            });

            expect(validator.validate(param, 'low').isValid).toBe(true);
            expect(validator.validate(param, 'medium').isValid).toBe(true);
            expect(validator.validate(param, 'invalid').isValid).toBe(false);
        });
    });

    describe('validateAll()', () => {
        it('validates all parameters successfully', () => {
            const params: Parameter[] = [
                createParam({ name: 'name', type: 'string', isRequired: true }),
                createParam({ name: 'age', type: 'number', isRequired: true })
            ];

            const provided = { name: 'John', age: 30 };
            const result = validator.validateAll(params, provided);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('collects errors from multiple parameters', () => {
            const params: Parameter[] = [
                createParam({ name: 'name', type: 'string', isRequired: true }),
                createParam({ name: 'age', type: 'number', isRequired: true })
            ];

            const provided = {}; // both parms are missing
            const result = validator.validateAll(params, provided);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });

        it('handles empty parameter list', () => {
            const result = validator.validateAll([], {});

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('validates with extra provided parameters', () => {
            const params: Parameter[] = [
                createParam({ name: 'required', type: 'string', isRequired: true })
            ];

            const provided = { required: 'value', extra: 'ignored' };
            const result = validator.validateAll(params, provided);

            expect(result.isValid).toBe(true);
        });
    });

    describe('Built-in Validators', () => {
        it('validates email addresses', () => {
            expect(validator.isEmail('test@example.com')).toBe(true);
            expect(validator.isEmail('user.name+tag@example.co.uk')).toBe(true);
            expect(validator.isEmail('invalid')).toBe(false);
            expect(validator.isEmail('@example.com')).toBe(false);
            expect(validator.isEmail('test@')).toBe(false);
        });

        it('validates URLs', () => {
            expect(validator.isURL('https://example.com')).toBe(true);
            expect(validator.isURL('http://localhost:3000')).toBe(true);
            expect(validator.isURL('invalid-url')).toBe(false);
            expect(validator.isURL('example.com')).toBe(false);
        });

        it('validates UUIDs', () => {
            expect(validator.isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
            expect(validator.isUUID('invalid-uuid')).toBe(false);
            expect(validator.isUUID('123e4567')).toBe(false);
        });

        it('validates phone numbers', () => {
            expect(validator.isPhoneNumber('+1234567890')).toBe(true);
            expect(validator.isPhoneNumber('+1 (234) 567-8900')).toBe(true);
            expect(validator.isPhoneNumber('invalid')).toBe(false);
        });

        it('validates ages', () => {
            expect(validator.isAge(0)).toBe(true);
            expect(validator.isAge(25)).toBe(true);
            expect(validator.isAge(130)).toBe(true);

            expect(validator.isAge(-1)).toBe(false);
            expect(validator.isAge(131)).toBe(false);
            expect(validator.isAge(25.5)).toBe(false);
        });

        it('validates country codes (ISO 3166-1 alpha-2)', () => {
            expect(validator.isCountryCode('US')).toBe(true);
            expect(validator.isCountryCode('DE')).toBe(true);
            expect(validator.isCountryCode('BO')).toBe(true);

            expect(validator.isCountryCode('bol')).toBe(false);
            expect(validator.isCountryCode('U')).toBe(false);
            expect(validator.isCountryCode('USA')).toBe(false);
            expect(validator.isCountryCode('1A')).toBe(false);
        });

        it('validates prices', () => {
            expect(validator.isPrice(0)).toBe(true);
            expect(validator.isPrice(9.99)).toBe(true);
            expect(validator.isPrice(100)).toBe(true);

            expect(validator.isPrice(-1)).toBe(false);
            expect(validator.isPrice(NaN)).toBe(false);
            expect(validator.isPrice(Infinity)).toBe(false);
        });

        it('validates percentages', () => {
            expect(validator.isPercentage(0)).toBe(true);
            expect(validator.isPercentage(50)).toBe(true);
            expect(validator.isPercentage(100)).toBe(true);

            expect(validator.isPercentage(-1)).toBe(false);
            expect(validator.isPercentage(101)).toBe(false);
        });

        it('validates positive numbers', () => {
            expect(validator.isPositiveNumber(1)).toBe(true);
            expect(validator.isPositiveNumber(0.1)).toBe(true);

            expect(validator.isPositiveNumber(0)).toBe(false);
            expect(validator.isPositiveNumber(-1)).toBe(false);
        });

        it('validates hex colors', () => {
            expect(validator.isHexColor('#fff')).toBe(true);
            expect(validator.isHexColor('#ffffff')).toBe(true);
            expect(validator.isHexColor('#ABC')).toBe(true);
            expect(validator.isHexColor('#AABBCC')).toBe(true);

            expect(validator.isHexColor('fff')).toBe(false);
            expect(validator.isHexColor('#ff')).toBe(false);
            expect(validator.isHexColor('#ffff')).toBe(false);
        });

        it('validates base64 strings', () => {
            expect(validator.isBase64('SGVsbG8gd29ybGQ=')).toBe(true);
            expect(validator.isBase64('U29tZSB0ZXh0')).toBe(true);

            expect(validator.isBase64('not-base64')).toBe(false);
            expect(validator.isBase64('@@@@')).toBe(false);
        });

        it('validates IPv4 addresses', () => {
            expect(validator.isIPv4('127.0.0.1')).toBe(true);
            expect(validator.isIPv4('192.168.1.1')).toBe(true);
            expect(validator.isIPv4('255.255.255.255')).toBe(true);

            expect(validator.isIPv4('256.0.0.1')).toBe(false);
            expect(validator.isIPv4('192.168.1')).toBe(false);
            expect(validator.isIPv4('abc.def.ghi.jkl')).toBe(false);
        });

    });

    describe('Edge Cases', () => {
        it('handles zero as valid number', () => {
            const param = createParam({ type: 'number' });
            expect(validator.validate(param, 0).isValid).toBe(true);
        });

        it('handles empty string as valid', () => {
            const param = createParam({ type: 'string' });
            expect(validator.validate(param, '').isValid).toBe(true);
        });

        it('handles empty array as valid', () => {
            const param = createParam({ type: 'array' });
            expect(validator.validate(param, []).isValid).toBe(true);
        });

        it('handles negative numbers', () => {
            const param = createParam({ type: 'number' });
            expect(validator.validate(param, -10).isValid).toBe(true);
        });

        it('handles very long strings', () => {
            const param = createParam({ type: 'string', validator: { max: 1000 } });
            const longString = 'a'.repeat(1001);
            expect(validator.validate(param, longString).isValid).toBe(false);
        });

        it('handles special characters in strings', () => {
            const param = createParam({ type: 'string' });
            expect(validator.validate(param, '!@#$%^&*()').isValid).toBe(true);
        });
    });
});