import type {Font} from '@antv/infographic';

export const configureLocalInfographicFonts = (fonts: Font[], setDefaultFont: (name: string) => void): void =>
{
    // getFonts returns live registry objects with encoded family names. Re-registering those
    // names adds aliases and leaves the original remote registrations intact. Clear the live URL maps.
    for (const font of fonts) {font.baseUrl = ''; font.fontWeight = {};}
    setDefaultFont('Arial');
};
