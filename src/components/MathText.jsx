import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function MathText({ text }) {
    if (!text) return null;

    // We split by $$...$$ for block math, and $...$ for inline math.
    // The regex captures the math content so we can identify it.
    // Explanation:
    // 1. \$\$([\s\S]+?)\$\$ captures block math
    // 2. \$((?!\$)[\s\S]+?)\$ captures inline math (negative lookahead avoids matching $$)
    const regex = /(\$\$[\s\S]+?\$\$|\$(?!\$)[\s\S]+?\$)/g;

    const parts = text.split(regex);

    return (
        <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {parts.map((part, index) => {
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    // Block math
                    const mathExpr = part.slice(2, -2);
                    return <BlockMath key={index} math={mathExpr} />;
                } else if (part.startsWith('$') && part.endsWith('$')) {
                    // Inline math
                    const mathExpr = part.slice(1, -1);
                    return <InlineMath key={index} math={mathExpr} />;
                }

                // Regular text (can still be empty if adjacent matches)
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
}
