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
 * Détermine si une transaction correspond à une règle selon son nom et sa description.
 */
export const doesRuleMatchTransaction = (rule: Rule, transaction: Transaction): boolean => {
    const nameRegex = toSafeRegExp(rule.transactionNameRegex);
    const descriptionRegex = toSafeRegExp(rule.transactionDescriptionRegex);

    if (!nameRegex && !descriptionRegex) {
        return false;
    }

    const nameMatches = nameRegex ? nameRegex.test(transaction.nom) : false;
    const descriptionMatches = descriptionRegex ? descriptionRegex.test(transaction.description) : false;

    return nameMatches || descriptionMatches;
};

/**
 * Catégorie unique associée à la règle, au format attendu par la transaction.
 */
export const getRuleCategoryIds = (rule: Rule): number[] => {
    return Number.isInteger(rule.categoriesId) && rule.categoriesId > 0 ? [rule.categoriesId] : [];
};
