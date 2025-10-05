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
        <div className="text-center text-sm text-muted-foreground">
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
