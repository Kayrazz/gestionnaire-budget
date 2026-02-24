<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";

interface Props {
    modelValue: boolean;
    message: string;
    type?: "success" | "info" | "alert";
    duration?: number;
}

const props = withDefaults(defineProps<Props>(), {
    type: "info",
    duration: 3500,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();

let closeTimer: ReturnType<typeof setTimeout> | null = null;

const clearCloseTimer = (): void => {
    if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
    }
};

const closeToast = (): void => {
    clearCloseTimer();
    emit("update:modelValue", false);
};

watch(
    () => props.modelValue,
    (isVisible) => {
        clearCloseTimer();

        if (!isVisible || props.duration <= 0) {
            return;
        }

        closeTimer = setTimeout(() => {
            emit("update:modelValue", false);
            closeTimer = null;
        }, props.duration);
    },
);

onBeforeUnmount(() => {
    clearCloseTimer();
});

const toastClass = computed(() => {
    return `toast-${props.type}`;
});
</script>

<template>
    <transition name="toast-fade">
        <div v-if="modelValue" class="toast" :class="toastClass" role="status" aria-live="polite">
            <span class="toast-message">{{ message }}</span>
            <button type="button" class="toast-close" aria-label="Fermer la notification" @click="closeToast">
                ×
            </button>
        </div>
    </transition>
</template>

<style scoped>
.toast {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    min-width: 260px;
    max-width: min(420px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: 10px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--color-text);
    background: var(--color-surface);
}

.toast-message {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
}

.toast-close {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 2px;
}

.toast-success {
    border-color: var(--success-color);
    background: color-mix(in srgb, var(--success-color) 18%, var(--color-surface));
    color: var(--success-color);
}

.toast-info {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 16%, var(--color-surface));
    color: var(--primary-color);
}

.toast-alert {
    border-color: var(--danger-color);
    background: color-mix(in srgb, var(--danger-color) 18%, var(--color-surface));
    color: var(--danger-color);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
    opacity: 0;
    transform: translate(-50%, -8px);
}

@media (max-width: 768px) {
    .toast {
        top: 12px;
        max-width: calc(100vw - 24px);
    }
}
</style>
