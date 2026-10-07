/**
 * Shared Clerk appearance configuration for a polished, Zoom-inspired
 * authentication experience. This only customizes visuals; all authentication
 * behavior remains controlled by Clerk.
 */
/**
 * Shared Clerk appearance object. Typed implicitly through usage with Clerk's
 * `appearance` prop; avoids a separate `@clerk/types` dependency.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0b5cff",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#13161c",
    colorForeground: "#13161c",
    colorMutedForeground: "#566072",
    colorBorder: "#e4e8ee",
    colorRing: "#0b5cff",
    colorDanger: "#d92d20",
    colorSuccess: "#12805c",
    colorWarning: "#b54708",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontFamilyButtons: "inherit",
  },
  layout: {
    // Let the component render flush inside our own styled card shell.
    elevation: "flush",
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton",
  },
  elements: {
    rootBox: "cl-rootBox",
    card: "cl-card",
    header: "cl-header",
    headerTitle: "cl-headerTitle",
    headerSubtitle: "cl-headerSubtitle",
    socialButtons: "cl-socialButtons",
    socialButtonsBlockButton: "cl-socialButtonsBlockButton",
    socialButtonsBlockButtonText: "cl-socialButtonsBlockButtonText",
    socialButtonsProviderIcon: "cl-socialButtonsProviderIcon",
    dividerRow: "cl-dividerRow",
    dividerText: "cl-dividerText",
    formFieldLabel: "cl-formFieldLabel",
    formFieldInput: "cl-formFieldInput",
    formFieldInputShowPasswordButton: "cl-formFieldInputShowPasswordButton",
    formFieldErrorText: "cl-formFieldErrorText",
    formButtonPrimary: "cl-formButtonPrimary",
    formButtonReset: "cl-formButtonReset",
    footer: "cl-footer",
    footerAction: "cl-footerAction",
    footerActionLink: "cl-footerActionLink",
    identityPreview: "cl-identityPreview",
    identityPreviewText: "cl-identityPreviewText",
    identityPreviewEditButton: "cl-identityPreviewEditButton",
    alert: "cl-alert",
    alertText: "cl-alertText",
    spinner: "cl-spinner",
    otpCodeFieldInput: "cl-otpCodeFieldInput",
    profileSection: "cl-profileSection",
  },
};
