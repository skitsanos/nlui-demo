// AntV 0.2.20 imports PostCSS solely for its optional remote-font export path.
// That path is outside this read-only, local-font capability. Deny it explicitly rather than
// bundling Node fs/path/url or silently pretending external font CSS was parsed.
export default {
    parse: (_css: string): never => {throw new Error('Remote font CSS and font-embedding export are disabled for controlled infographics.');}
};
