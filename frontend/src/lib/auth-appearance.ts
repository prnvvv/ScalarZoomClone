/**
 * Auth-page Clerk appearance and copy.
 *
 * This is intentionally separate from the shared `clerkAppearance` used by the
 * in-app navigation chrome (UserButton, modal SignIn/SignUp). The auth pages
 * render Clerk flush inside a single centered panel, so critical surface and
 * control styles are supplied as inline element styles (guaranteed to apply)
 * while finer spacing hooks are left to `auth.css` via scoped classes.
 */
export const authAppearance = {
  variables: {
    colorPrimary: "#0b5cff",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#13161c",
    colorForeground: "#13161c",
    colorMutedForeground: "#566072",
    colorBorder: "#ccd3dd",
    colorRing: "#0b5cff",
    colorDanger: "#d92d20",
    colorSuccess: "#12805c",
    colorWarning: "#b54708",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontFamilyButtons: "inherit",
  },
  layout: {
    // The panel shell in AuthShell provides the only surface; Clerk renders
    // flush inside it so there is never a card inside a card.
    elevation: "flush",
    socialButtonsPlacement: "bottom",
    socialButtonsVariant: "blockButton",
  },
  elements: {
    // Surface: force the Clerk widget to blend into the host .auth-panel.
    rootBox: {
      width: "100%",
    },
    card: {
      width: "100%",
      background: "transparent",
      boxShadow: "none",
      border: "0",
      borderRadius: "0",
      padding: "0",
    },
    header: {
      textAlign: "center",
      marginBottom: "20px",
    },
    headerTitle: {
      fontSize: "1.375rem",
      fontWeight: "600",
      letterSpacing: "-0.02em",
      lineHeight: "1.25",
      color: "#13161c",
      marginBottom: "4px",
    },
    headerSubtitle: {
      fontSize: "0.875rem",
      lineHeight: "1.5",
      color: "#566072",
    },
    // Social login: a proper neutral block button under the heading.
    socialButtons: {
      gap: "10px",
    },
    socialButtonsBlockButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      width: "100%",
      height: "44px",
      border: "1px solid #ccd3dd",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      color: "#13161c",
      fontSize: "0.9375rem",
      fontWeight: "500",
      boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
    },
    socialButtonsProviderIcon: {
      width: "18px",
      height: "18px",
    },
    dividerRow: {
      margin: "18px 0",
    },
    dividerText: {
      fontSize: "0.75rem",
      fontWeight: "500",
      color: "#8790a1",
      letterSpacing: "0.04em",
    },
    formFieldLabel: {
      fontSize: "0.8125rem",
      fontWeight: "500",
      color: "#13161c",
      marginBottom: "6px",
    },
    formFieldInput: {
      width: "100%",
      height: "44px",
      padding: "0 12px",
      border: "1px solid #ccd3dd",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      color: "#13161c",
      fontSize: "0.9375rem",
    },
    formFieldErrorText: {
      fontSize: "0.75rem",
      color: "#d92d20",
      marginTop: "4px",
    },
    formButtonPrimary: {
      width: "100%",
      height: "44px",
      marginTop: "6px",
      border: "0",
      borderRadius: "10px",
      backgroundColor: "#0b5cff",
      color: "#ffffff",
      fontSize: "0.9375rem",
      fontWeight: "500",
    },
    formButtonReset: {
      color: "#0b5cff",
      backgroundColor: "transparent",
      border: "0",
      cursor: "pointer",
      fontSize: "0.8125rem",
      fontWeight: "500",
    },
    // Footer: clear account-switch row, small centered footer.
    footer: {
      marginTop: "20px",
      textAlign: "center",
    },
    footerAction: {
      fontSize: "0.8125rem",
      color: "#566072",
    },
    footerActionLink: {
      color: "#0b5cff",
      fontWeight: "500",
    },
    identityPreview: {
      backgroundColor: "#fafbfd",
      border: "1px solid #e4e8ee",
      borderRadius: "10px",
      marginBottom: "18px",
    },
    alert: {
      backgroundColor: "#fdeceb",
      color: "#d92d20",
      borderRadius: "10px",
      fontSize: "0.8125rem",
    },
    otpCodeFieldInput: {
      width: "44px",
      height: "52px",
      border: "1px solid #ccd3dd",
      borderRadius: "10px",
      fontSize: "1.25rem",
      fontWeight: "600",
      textAlign: "center",
    },
    spinner: {
      border: "2px solid rgba(11, 92, 255, 0.22)",
      borderTopColor: "#0b5cff",
    },
  },
};

/**
 * Product copy for the auth surfaces. Overrides the Clerk instance defaults
 * ("Sign in to My Application") without changing any authentication behavior.
 */
export const authLocalization = {
  signIn: {
    start: {
      title: "Sign in to Scalar Meet",
      subtitle: "Welcome back! Please sign in to continue.",
      actionText: "Don't have an account?",
      actionLink: "Sign up",
    },
  },
  signUp: {
    start: {
      title: "Sign up to Scalar Meet",
      subtitle: "Create your account to start hosting meetings.",
      actionText: "Already have an account?",
      actionLink: "Sign in",
    },
  },
};