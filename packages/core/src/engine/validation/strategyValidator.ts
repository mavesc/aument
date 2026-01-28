import { ManifestResolver } from "../manifestResolver";
import { ParameterValidator } from "./parameterValidator";
import { Strategy, StrategyValidationError, StrategyValidationResult, Intent } from "../types";
import { Manifest } from "../../schema/types";
import { StrategyDetailedValidationResult } from "../types";
export class StrategyValidator {
    constructor(
        private manifestResolver: ManifestResolver,
        private paramValidator: ParameterValidator
    ) { }

    validate(strategy: Strategy, manifest: Manifest): StrategyValidationResult {
        const errors: StrategyValidationError[] = [];

        if (!Array.isArray(strategy)) {
            errors.push(new StrategyValidationError(
                'Strategy must be an array',
                -1
            ));
            return { isValid: false, errors };
        }

        if (strategy.length === 0) {
            errors.push(new StrategyValidationError(
                'Strategy cannot be empty',
                -1
            ));
            return { isValid: false, errors };
        }

        strategy.forEach((intent, index) => {
            const intentErrors = this.validateIntent(intent, index, manifest);
            errors.push(...intentErrors);
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private validateIntent(
        intent: Intent,
        index: number,
        manifest: Manifest
    ): StrategyValidationError[] {
        const errors: StrategyValidationError[] = [];

        if (!intent || typeof intent !== 'object') {
            errors.push(new StrategyValidationError(
                'Intent must be an object',
                index
            ));
            return errors;
        }

        if (!intent.capabilityId) {
            errors.push(new StrategyValidationError(
                'Intent missing capabilityId',
                index,
                'capabilityId'
            ));
            return errors;
        }

        if (!intent.parameters || typeof intent.parameters !== 'object') {
            errors.push(new StrategyValidationError(
                'Intent missing or invalid parameters object',
                index,
                'parameters'
            ));
            return errors;
        }

        const capability = this.manifestResolver.getCapability(manifest, intent.capabilityId);
        if (!capability) {
            errors.push(new StrategyValidationError(
                `Capability "${intent.capabilityId}" not found in manifest`,
                index,
                'capabilityId'
            ));
            return errors;
        }

        const paramResult = this.paramValidator.validateAll(
            capability.parameters,
            intent.parameters
        );

        if (!paramResult.isValid) {
            paramResult.errors.forEach(error => {
                errors.push(new StrategyValidationError(
                    error,
                    index,
                    'parameters'
                ));
            });
        }

        return errors;
    }

    validateWithSuggestions(
        strategy: Strategy,
        manifest: Manifest
    ): StrategyDetailedValidationResult {
        const result = this.validate(strategy, manifest);
        const suggestions: string[] = [];

        result.errors.forEach(error => {
            if (error.message.includes('not found')) {
                const similar = this.findSimilarCapabilities(
                    error.details as string,
                    manifest
                );
                if (similar.length > 0) {
                    suggestions.push(`Did you mean: ${similar.join(', ')}?`);
                }
            }
        });

        return {
            ...result,
            suggestions
        };
    }

    private findSimilarCapabilities(
        query: string,
        manifest: Manifest
    ): string[] {
        // TODO: Enhance current implementation (it currently uses simple string similarity). 
        // Suggestions: Levenshtein distance, Jaro-Winkler similarity, maybe? 
        const allIds = this.manifestResolver.getCapabilityIds(manifest);
        return allIds
            .filter(id => id.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3);
    }
}