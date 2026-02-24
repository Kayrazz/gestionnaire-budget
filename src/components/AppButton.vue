<script setup lang="ts">
import { computed } from "vue";

/**
 * Variantes visuelles disponibles pour le bouton.
 */
type ButtonVariant = "default" | "danger" | "surface";

/**
 * Tailles disponibles pour ajuster l'espacement du bouton.
 */
type ButtonSize = "md" | "sm";

interface AppButtonProps {
    type?: "button" | "submit" | "reset";
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
}

const props = withDefaults(defineProps<AppButtonProps>(), {
    type: "button",
    variant: "default",
    size: "md",
    disabled: false,
});

const buttonClass = computed<string>(() => {
    const variantClass =
        props.variant === "danger"
            ? "border-red-500 text-red-600 hover:bg-red-200 focus:ring-red-500"
            : props.variant === "surface"
              ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--hover-bg)] focus:ring-[var(--primary-color)]"
              : "border-gray-300 text-[var(--color-text)] hover:bg-gray-400 focus:ring-gray-500";

    const sizeClass = props.size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2";

    return `rounded border ${variantClass} ${sizeClass} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`;
});
</script>

<template>
    <button :type="type" :class="buttonClass" :disabled="disabled">
        <slot />
    </button>
</template>

<style scoped></style>
