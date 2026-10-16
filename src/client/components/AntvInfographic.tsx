import {getFonts, Infographic, setDefaultFont} from '@antv/infographic';
import {useEffect, useId, useRef} from 'react';
import type {InfographicBlock} from '../../nlui/infographic/schema.ts';
import {configureLocalInfographicFonts} from '../infographicFonts.ts';
import {infographicOptions, qualifyInfographicSvg} from '../infographicOptions.ts';

// v0.2.20 loads ALL registered fonts, even if a system font is selected. Empty their URL maps before rendering.
configureLocalInfographicFonts(getFonts(), setDefaultFont);

export const AntvInfographic = ({block, onFailure}: {block: InfographicBlock; onFailure: () => void}) =>
{
    const container = useRef<HTMLDivElement>(null); const id = useId().replaceAll(/[^a-zA-Z0-9_-]/g, '');
    useEffect(() =>
    {
        let instance: Infographic | undefined; let frame = 0; let active = true;
        const fail = () => {if (active) onFailure();};
        try
        {
            instance = new Infographic({...infographicOptions(block), container: container.current!});
            instance.on('error', fail);
            instance.on('rendered', ({node}: {node: SVGSVGElement}) =>
            {
                frame = requestAnimationFrame(() =>
                {
                    if (!active) return;
                    try
                    {
                        qualifyInfographicSvg(node, `nlui-figure-${id}`);
                        const bounds = node.viewBox.baseVal;
                        if (!(bounds.width > 0 && bounds.height > 0)) throw new Error('Empty figure');
                        node.setAttribute('aria-hidden', 'true'); node.setAttribute('focusable', 'false');
                        container.current!.dataset.ready = 'true';
                    }
                    catch {fail();}
                });
            });
            instance.render();
        }
        catch {fail();}
        return () => {active = false; cancelAnimationFrame(frame); instance?.destroy();};
    }, [block, id, onFailure]);
    return <div ref={container} className={`infographic-canvas infographic-canvas-${block.view}`} aria-hidden="true"/>;
};
