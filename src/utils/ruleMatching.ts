import type { Rule, Transaction } from "./JsonManager";

/**
 * Construit une expression régulière insensible à la casse depuis une chaîne utilisateur.
 * Retourne null si la valeur est vide ou invalide.
 */
const toSafeRegExp = (pattern: string): RegExp | null => {
    const normalizedPattern = pattern.trim();
    if (!normalizedPattern) {
        return null;
    }

    try {
        return new RegExp(normalizedPattern, "i");
    } catch {
        return null;
    }
};

/**
 * Retire les enveloppes historiques de type .*( ... ).* pour exposer un format lisible.
 */
const stripLegacyRegexWrapper = (pattern: string): string => {
    const normalizedPattern = pattern.trim();

    const wrappedGroupMatch = normalizedPattern.match(/^\.\*\((.*)\)\.\*$/);
    if (wrappedGroupMatch?.[1]) {
        return wrappedGroupMatch[1].trim();
    }

    const wrappedPlainMatch = normalizedPattern.match(/^\.\*(.*)\.\*$/);
    if (wrappedPlainMatch?.[1]) {
        return wrappedPlainMatch[1].trim();
    }

    return normalizedPattern;
};

const normalizeSearchText = (value: string): string => {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

const splitKeywords = (pattern: string): string[] => {
    return stripLegacyRegexWrapper(pattern)
        .split(/[|,;\n]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

const containsRegexMetaCharacters = (pattern: string): boolean => {
    return /[\\^$+?()[\]{}]/.test(pattern);
};

const matchPattern = (pattern: string, targetValue: string): boolean => {
    const rawPattern = pattern.trim();
    if (!rawPattern) {
        return false;
    }

    const cleanedPattern = stripLegacyRegexWrapper(rawPattern);
    const keywords = splitKeywords(rawPattern);
    const normalizedTarget = normalizeSearchText(targetValue);

    const hasKeywordSeparator = /[|,;\n]/.test(cleanedPattern);
    const shouldUseRegex = containsRegexMetaCharacters(cleanedPattern) && !hasKeywordSeparator;

    if (!shouldUseRegex && keywords.length > 0) {
        return keywords.some((keyword) => normalizedTarget.includes(normalizeSearchText(keyword)));
    }

    const regex = toSafeRegExp(rawPattern);
    return regex ? regex.test(targetValue) : false;
};

/**
 * Convertit une règle en format de saisie lisible pour l'interface.
 */
export const formatRulePatternForInput = (pattern: string): string => {
    return stripLegacyRegexWrapper(pattern);
};

/**
 * Normalise la valeur saisie par l'utilisateur avant persistance.
 */
export const normalizeRulePatternForStorage = (pattern: string): string => {
    return formatRulePatternForInput(pattern)
        .split(/[|,;\n]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .join(" | ");
};

/**
 * Détermine si une transaction correspond à une règle selon son nom et sa description.
 */
export const doesRuleMatchTransaction = (rule: Rule, transaction: Transaction): boolean => {
    if (!rule.transactionNameRegex.trim() && !rule.transactionDescriptionRegex.trim()) {
        return false;
    }

    const nameMatches = matchPattern(rule.transactionNameRegex, transaction.nom);
    const descriptionMatches = matchPattern(rule.transactionDescriptionRegex, transaction.description);

    return nameMatches || descriptionMatches;
};

/**
 * Catégorie unique associée à la règle, au format attendu par la transaction.
 */
export const getRuleCategoryIds = (rule: Rule): number[] => {
    return Number.isInteger(rule.categoriesId) && rule.categoriesId > 0 ? [rule.categoriesId] : [];
};
