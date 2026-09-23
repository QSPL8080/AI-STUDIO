import React, { useState, useEffect, useMemo } from "react";
import {
  PayPalScriptProvider,
  PayPalButtons,
} from "@paypal/react-paypal-js";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Package,
  Video,
  Clock,
  Zap,
  RotateCcw,
} from "lucide-react";
import {
  resolvePurchaseItem,
  INDIVIDUAL_PRICING,
  PACKAGE_TIERS,
  PACKAGE_SERVICE_LABELS,
  type IndividualServiceId,
  type PackageTierId,
  type PackageServiceFormat,
  type ResolvedPurchaseItem,
} from "@/lib/pricing";
import {
  getPayPalConfigServerFn,
  createPayPalOrderServerFn,
  capturePayPalOrderServerFn,
  broadcastOrderEvent,
} from "@/lib/paypal-actions";

export interface CheckoutModalOptions {
  itemType: "individual" | "package" | "setup";
  itemId?: string;
  tierId?: PackageTierId;
  format?: PackageServiceFormat;
}

/**
 * Global helper to trigger the checkout modal from anywhere in the app.
 */
export function openCheckoutModal(options: CheckoutModalOptions) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("open-checkout-modal", { detail: options })
    );
  }
}

export function CheckoutModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [itemType, setItemType] = useState<"individual" | "package" | "setup">("individual");
  const [individualService, setIndividualService] = useState<IndividualServiceId>("ai-ugc");
  const [packageTier, setPackageTier] = useState<PackageTierId>("growth");
  const [packageFormat, setPackageFormat] = useState<PackageServiceFormat>("ai-ugc");

  // Customer Information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  // UI States
  const [formErrors, setFormErrors] = useState<{ fullName?: string; email?: string }>({});
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // PayPal config state
  const [paypalClientId, setPayPalClientId] = useState<string>("");
  const [paypalEnv, setPayPalEnv] = useState<string>("sandbox");

  // Success details state
  const [successDetails, setSuccessDetails] = useState<{
    orderId: string;
    captureId?: string;
    itemName: string;
    amount: number;
    currency: string;
    customerName: string;
  } | null>(null);

  // Fetch PayPal public config once on mount
  useEffect(() => {
    let isMounted = true;
    getPayPalConfigServerFn()
      .then((res) => {
        if (isMounted && res.success && res.clientId) {
          setPayPalClientId(res.clientId);
          setPayPalEnv(res.environment || "sandbox");
        }
      })
      .catch((err) => {
        console.warn("Failed to load PayPal public config:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to open-checkout-modal event
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<CheckoutModalOptions>;
      const detail = customEvent.detail;
      if (detail) {
        setItemType(detail.itemType || "individual");

        if (detail.itemType === "setup") {
          setIndividualService("digital-twin-setup");
        } else if (detail.itemType === "individual" && detail.itemId) {
          const validId = detail.itemId as IndividualServiceId;
          if (INDIVIDUAL_PRICING[validId]) {
            setIndividualService(validId);
          }
        } else if (detail.itemType === "package") {
          if (detail.tierId && PACKAGE_TIERS[detail.tierId]) {
            setPackageTier(detail.tierId);
          }
          if (detail.format && PACKAGE_SERVICE_LABELS[detail.format]) {
            setPackageFormat(detail.format);
          }
        }
      }

      setStep("form");
      setErrorMessage(null);
      setIsOpen(true);
      document.body.style.overflow = "hidden";
    };

    window.addEventListener("open-checkout-modal", handleOpen);
    return () => {
      window.removeEventListener("open-checkout-modal", handleOpen);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    document.body.style.overflow = "auto";
    setTimeout(() => {
      setStep("form");
      setErrorMessage(null);
      setSuccessDetails(null);
    }, 300);
  };

  // Compute resolved item details authoritatively
  const resolvedItem = useMemo<ResolvedPurchaseItem | null>(() => {
    if (itemType === "setup") {
      return resolvePurchaseItem({ itemType: "setup" });
    }
    if (itemType === "individual") {
      return resolvePurchaseItem({
        itemType: "individual",
        itemId: individualService,
      });
    }
    if (itemType === "package") {
      return resolvePurchaseItem({
        itemType: "package",
        tierId: packageTier,
        format: packageFormat,
      });
    }
    return null;
  }, [itemType, individualService, packageTier, packageFormat]);

  // Form Validation
  const validateForm = () => {
    const errors: { fullName?: string; email?: string } = {};
    if (!fullName.trim()) {
      errors.fullName = "Please enter your full name";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setErrorMessage(null);
    setStep("payment");
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto backdrop-blur-md bg-slate-950/60 animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-purple-200/90 bg-white/98 shadow-2xl shadow-purple-950/20 backdrop-blur-2xl transition-all duration-300 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Header Accent Bar */}
        <div className="h-2 w-full bg-gradient-brand" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-xs">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2
                id="checkout-modal-title"
                className="text-base sm:text-lg font-bold tracking-tight text-slate-900"
              >
                {step === "success" ? "Order Confirmed" : "Secure PayPal Checkout"}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Official Quickupp AI Studio Video Production
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close checkout modal"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 sm:p-7 space-y-6">
          {/* STEP 1: CUSTOMER DETAILS & SUMMARY FORM */}
          {step === "form" && (
            <form onSubmit={handleProceedToPayment} className="space-y-5">
              {/* Selected Service / Package Box */}
              <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 via-white to-pink-50/30 p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100/70 pb-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-800">
                        {itemType === "package" ? "Package Bundle" : "Individual Service"}
                      </span>
                      {resolvedItem?.delivery && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Clock className="h-3 w-3 text-purple-600" />
                          {resolvedItem.delivery}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {resolvedItem?.itemName || "AI Video Service"}
                    </h3>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-2xl font-black tracking-tight text-purple-700">
                      {resolvedItem?.amountFormatted || "$0.00 USD"}
                    </span>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">
                      One-time payment
                    </p>
                  </div>
                </div>

                {/* Switcher Option if needed */}
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {itemType === "individual" && (
                    <div className="col-span-full">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Select Video Format:
                      </label>
                      <select
                        value={individualService}
                        onChange={(e) => setIndividualService(e.target.value as IndividualServiceId)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      >
                        {Object.values(INDIVIDUAL_PRICING).map((srv) => (
                          <option key={srv.id} value={srv.id}>
                            {srv.name} — {srv.formattedPrice}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {itemType === "package" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Package Volume:
                        </label>
                        <select
                          value={packageTier}
                          onChange={(e) => setPackageTier(e.target.value as PackageTierId)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        >
                          {Object.values(PACKAGE_TIERS).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.videos} {t.videos === 1 ? "Video" : "Videos"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Video Style:
                        </label>
                        <select
                          value={packageFormat}
                          onChange={(e) => setPackageFormat(e.target.value as PackageServiceFormat)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        >
                          {Object.entries(PACKAGE_SERVICE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Input Fields */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Customer Information
                </h4>

                <div>
                  <label
                    htmlFor="checkoutFullName"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="checkoutFullName"
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (formErrors.fullName) {
                        setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 shadow-xs transition-all focus:outline-none focus:ring-2 ${
                      formErrors.fullName
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-purple-500 focus:ring-purple-100"
                    }`}
                  />
                  {formErrors.fullName && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      {formErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="checkoutEmail"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="checkoutEmail"
                    type="email"
                    required
                    placeholder="sarah@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) {
                        setFormErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 shadow-xs transition-all focus:outline-none focus:ring-2 ${
                      formErrors.email
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-purple-500 focus:ring-purple-100"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="checkoutPhone"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Phone Number (Optional)
                    </label>
                    <input
                      id="checkoutPhone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 shadow-xs transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkoutCompany"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Company / Brand (Optional)
                    </label>
                    <input
                      id="checkoutCompany"
                      type="text"
                      placeholder="e.g. Acme Studio"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 shadow-xs transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                </div>
              </div>

              {/* Continue to PayPal Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm sm:text-base font-bold text-neon-foreground shadow-lg shadow-purple-500/25 transition-all duration-200 hover:scale-[1.01] hover:brightness-110 active:scale-98"
                >
                  <span>Continue to PayPal</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  <span>256-bit SSL encrypted & verified PayPal transaction</span>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: OFFICIAL PAYPAL CHECKOUT BUTTONS */}
          {step === "payment" && resolvedItem && (
            <div className="space-y-5">
              {/* Back to details button & order summary */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Edit Contact Details</span>
                </button>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Customer: </span>
                  <span className="text-xs font-bold text-slate-800">{fullName}</span>
                </div>
              </div>

              {/* Order Recap Banner */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{resolvedItem.itemName}</p>
                  <p className="text-[11px] text-slate-500">{email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-purple-700">
                    {resolvedItem.amountFormatted}
                  </p>
                </div>
              </div>

              {/* Error message alert */}
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-red-800 text-xs font-medium">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Official PayPal Buttons Container */}
              <div className="relative min-h-[160px] flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5">
                {paypalClientId ? (
                  <PayPalScriptProvider
                    options={{
                      clientId: paypalClientId,
                      currency: "USD",
                      intent: "capture",
                    }}
                  >
                    <div className="w-full max-w-sm">
                      <PayPalButtons
                        style={{
                          layout: "vertical",
                          color: "gold",
                          shape: "rect",
                          label: "pay",
                          height: 44,
                        }}
                        disabled={isProcessing}
                        createOrder={async () => {
                          try {
                            setIsProcessing(true);
                            setErrorMessage(null);
                            const res = await createPayPalOrderServerFn({
                              data: {
                                itemType: resolvedItem.itemType,
                                itemId: resolvedItem.itemId,
                                tierId: resolvedItem.tierId,
                                format: resolvedItem.format,
                                customerName: fullName,
                                customerEmail: email,
                                customerPhone: phone,
                                customerCompany: company,
                              },
                            });

                            if (!res.success || !res.orderId) {
                              throw new Error(res.error || "Failed to initialize PayPal order.");
                            }

                            return res.orderId;
                          } catch (err: any) {
                            console.error("PayPal createOrder error:", err);
                            setErrorMessage(
                              err.message || "Failed to create PayPal order. Please try again."
                            );
                            setIsProcessing(false);
                            throw err;
                          }
                        }}
                        onApprove={async (data) => {
                          try {
                            setIsProcessing(true);
                            const res = await capturePayPalOrderServerFn({
                              data: { orderId: data.orderID },
                            });

                            if (!res.success) {
                              throw new Error(
                                res.error || "Payment verification failed on the server."
                              );
                            }

                            // Payment Completed Successfully
                            setSuccessDetails({
                              orderId: data.orderID,
                              captureId: res.captureId,
                              itemName: resolvedItem.itemName,
                              amount: resolvedItem.amount,
                              currency: resolvedItem.currency,
                              customerName: fullName,
                            });

                            // Broadcast real-time event for admin sync
                            if (res.order) {
                              broadcastOrderEvent({
                                type: "NEW_ORDER",
                                order: res.order,
                              });
                            }

                            setStep("success");
                          } catch (err: any) {
                            console.error("PayPal capture error:", err);
                            setErrorMessage(
                              err.message || "Payment capture failed. Please contact support."
                            );
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        onCancel={() => {
                          setIsProcessing(false);
                          setErrorMessage("Payment was cancelled. You can retry whenever you're ready.");
                        }}
                        onError={(err) => {
                          console.error("PayPal button error:", err);
                          setIsProcessing(false);
                          setErrorMessage(
                            "An error occurred while communicating with PayPal. Please check your network or try again."
                          );
                        }}
                      />
                    </div>
                  </PayPalScriptProvider>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <div className="inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-purple-600 border-t-transparent" />
                    <p className="text-xs text-slate-600 font-medium">
                      Initializing secure PayPal connection...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      (If testing locally, verify PAYPAL_CLIENT_ID in your environment variables)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT CONFIRMATION / SUCCESS SCREEN */}
          {step === "success" && successDetails && (
            <div className="text-center py-4 space-y-5 animate-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50 shadow-inner">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Payment Successful!
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Thank you for your purchase, <span className="font-bold">{successDetails.customerName}</span>.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left text-xs space-y-2.5 shadow-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Service / Package:</span>
                  <span className="font-bold text-slate-900 text-right">{successDetails.itemName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-purple-700 text-sm">
                    ${successDetails.amount.toFixed(2)} {successDetails.currency}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">PayPal Order ID:</span>
                  <span className="font-mono text-[11px] text-slate-700 select-all">
                    {successDetails.orderId}
                  </span>
                </div>
                {successDetails.captureId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Capture ID:</span>
                    <span className="font-mono text-[11px] text-slate-700 select-all">
                      {successDetails.captureId}
                    </span>
                  </div>
                )}
              </div>

              {/* Next Steps Notification */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 text-xs text-purple-900 leading-relaxed font-medium">
                <Sparkles className="h-4 w-4 text-purple-600 inline mr-1.5 -mt-0.5" />
                Our creative team has received your order and will contact you via email shortly to begin your AI video production script and assets.
              </div>

              {/* Close / Done Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 active:scale-98"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
