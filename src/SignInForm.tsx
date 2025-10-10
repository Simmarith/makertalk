"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [formLoadTime, setFormLoadTime] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  useEffect(() => {
    setFormLoadTime(Date.now());
  }, []);

  // Validation functions
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getPasswordErrors = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
    if (!/\d/.test(password)) errors.push("One number");
    return errors;
  };

  const emailError = emailTouched && !isValidEmail(email) ? "Please enter a valid email address" : "";
  const passwordErrors = passwordTouched && flow === "signUp" ? getPasswordErrors(password) : [];
  const confirmPasswordError = confirmPasswordTouched && flow === "signUp" && password !== confirmPassword ? "Passwords do not match" : "";
  const isFormValid = isValidEmail(email) && (flow === "signIn" || (getPasswordErrors(password).length === 0 && password === confirmPassword));

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          
          // Honeypot check
          if (formData.get("website")) {
            return;
          }
          
          // Time-based check (minimum 2 seconds)
          const timeTaken = Date.now() - formLoadTime;
          if (timeTaken < 2000) {
            toast.error("Please take your time filling out the form.");
            return;
          }

          // Frontend validation
          if (!isFormValid) {
            if (!isValidEmail(email)) {
              toast.error("Please enter a valid email address");
              return;
            }
            if (flow === "signUp" && passwordErrors.length > 0) {
              toast.error("Please fix password requirements");
              return;
            }
            if (flow === "signUp" && password !== confirmPassword) {
              toast.error("Passwords do not match");
              return;
            }
          }
          
          setSubmitting(true);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div>
          <input
            className={`auth-input-field ${emailError ? 'border-red-500 focus:ring-red-500' : ''}`}
            type="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
          />
          {emailError && (
            <div className="text-red-500 text-sm mt-1">{emailError}</div>
          )}
        </div>
        
        <div className="mt-3">
          <input
            className={`auth-input-field ${passwordErrors.length > 0 ? 'border-red-500 focus:ring-red-500' : ''}`}
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            required
          />
          {passwordErrors.length > 0 && flow === "signUp" && (
            <div className="text-red-500 text-sm mt-1">
              <div className="font-medium">Password must include:</div>
              <ul className="ml-4 list-disc">
                {passwordErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {flow === "signUp" && (
          <div className="mt-3">
            <input
              className={`auth-input-field ${confirmPasswordError ? 'border-red-500 focus:ring-red-500' : ''}`}
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmPasswordTouched(true)}
              required
            />
            {confirmPasswordError && (
              <div className="text-red-500 text-sm mt-1">{confirmPasswordError}</div>
            )}
          </div>
        )}
        {/* Honeypot field - hidden from users */}
        <input
          type="text"
          name="website"
          autoComplete="off"
          tabIndex={-1}
          style={{ position: 'absolute', left: '-9999px' }}
        />
        <button 
          className={`auth-button mt-8 ${!isFormValid ? 'opacity-50 cursor-not-allowed' : ''}`} 
          type="submit" 
          disabled={submitting || !isFormValid}
        >
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => void signIn("google")}
          className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Google</span>
        </button>
        <div className="text-center text-sm text-muted-foreground mt-4">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setEmailTouched(false);
              setPasswordTouched(false);
              setConfirmPasswordTouched(false);
              setConfirmPassword("");
            }}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
