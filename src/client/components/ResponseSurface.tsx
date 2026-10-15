import type {ComponentProps} from 'react';
import {lazy, Suspense} from 'react';
import {NluiRenderer} from './NluiRenderer.tsx';

const ExperimentalSurface = lazy(async () => ({default: (await import('./ExperimentalSurface.tsx')).ExperimentalSurface}));
export const ResponseSurface = (props: ComponentProps<typeof NluiRenderer>) =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderer') === 'a2ui'
        ? <Suspense fallback={<NluiRenderer {...props}/>}><ExperimentalSurface {...props}/></Suspense>
        : <NluiRenderer {...props}/>;
