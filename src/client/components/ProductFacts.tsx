import {factPresentation, type ProductFact} from '../../nlui/productFacts.ts';

export const ProductFacts = ({sku, facts}: {sku: string; facts: ProductFact[]}) => facts.length > 0 ? (
    <dl className="product-facts" data-product-sku={sku} aria-label="Product specifications">
        {facts.map((fact) =>
        {
            const {label, value} = factPresentation(fact);
            return <div key={fact.key} data-product-fact={fact.key}><dt>{label}</dt><dd>{value}</dd></div>;
        })}
    </dl>
) : null;
