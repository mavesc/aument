import { Capability, Manifest } from "../schema";
import { manifestValidator } from "../schema";
export class ManifestResolver {
    private manifestCache = new Map<string, Manifest>();

    load(manifest: Manifest): void {
        manifestValidator.validateOrThrow(manifest);
        manifestValidator.validateSemantics(manifest);

        const key = this.getManifestKey(manifest);
        this.manifestCache.set(key, manifest);
    }

    getCapability(manifest: Manifest, capabilityId: string): Capability | null {
        return manifest.capabilities[capabilityId] || null;
    }

    hasCapability(manifest: Manifest, capabilityId: string): boolean {
        return capabilityId in manifest.capabilities;
    }

    getCapabilityIds(manifest: Manifest): string[] {
        return Object.keys(manifest.capabilities);
    }

    private getManifestKey(manifest: Manifest): string {
        return `${manifest.metadata.name}@${manifest.version}`;
    }
}