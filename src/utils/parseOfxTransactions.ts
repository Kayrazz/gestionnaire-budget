export interface ParsedOfxTransaction {
    date: string;
    amount: number;
    nom: string;
    description: string;
    status: string;
    fitId: string | null;
}

const toIsoDate = (rawDate: string): string | null => {
    const trimmedDate = rawDate.trim();
    const dateMatch = trimmedDate.match(/^(\d{4})(\d{2})(\d{2})/);

    if (!dateMatch) {
        return null;
    }

    const [, year, month, day] = dateMatch;
    return `${year}-${month}-${day}T00:00:00.000Z`;
};

const parseAmount = (rawAmount: string): number | null => {
    const normalizedAmount = rawAmount.trim().replace(",", ".");
    const parsedAmount = Number(normalizedAmount);
    return Number.isFinite(parsedAmount) ? parsedAmount : null;
};

const extractTagValue = (block: string, tag: string): string | null => {
    const pattern = new RegExp(`<${tag}>([\\s\\S]*?)(?=<[A-Z0-9_]+>|$)`, "i");
    const match = block.match(pattern);

    if (!match || !match[1]) {
        return null;
    }

    return match[1].trim();
};

const extractTransactionBlocks = (ofxContent: string): string[] => {
    const blocks = ofxContent.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi);
    return blocks ?? [];
};

export const parseOfxTransactions = (ofxContent: string): ParsedOfxTransaction[] => {
    const blocks = extractTransactionBlocks(ofxContent);

    if (blocks.length === 0) {
        throw new Error("Aucune transaction OFX (STMTTRN) trouvée dans le fichier.");
    }

    const parsedTransactions = blocks
        .map((block: string): ParsedOfxTransaction | null => {
            const rawDate = extractTagValue(block, "DTPOSTED");
            const rawAmount = extractTagValue(block, "TRNAMT");

            if (!rawDate || !rawAmount) {
                return null;
            }

            const date = toIsoDate(rawDate);
            const amount = parseAmount(rawAmount);

            if (!date || amount === null) {
                return null;
            }

            const transactionType = extractTagValue(block, "TRNTYPE") ?? "IMPORTED";
            const fitId = extractTagValue(block, "FITID");
            const name = extractTagValue(block, "NAME");
            const memo = extractTagValue(block, "MEMO");

            return {
                date,
                amount,
                nom: name?.trim() || memo?.trim() || `OFX ${transactionType}`,
                description: memo?.trim() ?? "",
                status: transactionType.trim(),
                fitId: fitId?.trim() ?? null,
            };
        })
        .filter((transaction): transaction is ParsedOfxTransaction => transaction !== null);

    if (parsedTransactions.length === 0) {
        throw new Error("Le fichier OFX ne contient aucune transaction valide.");
    }

    return parsedTransactions;
};
