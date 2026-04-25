"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DISPOSITIONS,
  DISPOSITION_LABELS,
  DISPOSITION_COLORS,
  type Lead,
  type Disposition,
} from "@/lib/constants";
import {
  DEFAULT_KEYBINDINGS,
  matchesKeybinding,
  formatKeyDisplay,
  KEYBINDINGS_SETTING_KEY,
  CATEGORY_LABELS,
} from "@/lib/keybindings";

// Helper: announce to screen readers via the global live region
function announce(message: string) {
  const el = document.getElementById("live-announcements");
  if (el) {
    el.textContent = "";
    // Small delay to ensure the screen reader picks up the change
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

// Helper: merge template with lead data
function mergeTemplate(template: string, lead: Lead): string {
  return template
    .replace(/\{\{first_name\}\}/gi, lead.firstName)
    .replace(/\{\{last_name\}\}/gi, lead.lastName)
    .replace(/\{\{company\}\}/gi, lead.company)
    .replace(/\{\{casual_name\}\}/gi, lead.casualName || lead.company)
    .replace(/\{\{city\}\}/gi, lead.city)
    .replace(/\{\{state\}\}/gi, lead.state)
    .replace(/\{\{email\}\}/gi, lead.email)
    .replace(/\{\{phone\}\}/gi, lead.phone)
    .replace(/\{\{website\}\}/gi, lead.website);
}

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [calling, setCalling] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Parallel Dialer State
  const [userProfile, setUserProfile] = useState<{userId: string, role: string} | null>(null);
  const [maxParallelDials, setMaxParallelDials] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Dialer state
  const [dialerNumber, setDialerNumber] = useState("");
  const [showDialer, setShowDialer] = useState(false);
  const [lastDtmfDigit, setLastDtmfDigit] = useState("");

  // Incoming call state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [incomingFrom, setIncomingFrom] = useState("");
  const [deviceReady, setDeviceReady] = useState(false);
  const [matchedLead, setMatchedLead] = useState<Lead | null>(null);

  // SMS state
  const [smsBody, setSmsBody] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  type SmsLogEntry = {
    id: string;
    leadId: string;
    leadName: string;
    leadPhone: string;
    body: string;
    status: string;
    twilioSid: string;
    direction: string;
    sentAt: string;
  };
  const [smsHistory, setSmsHistory] = useState<SmsLogEntry[]>([]);

  // Call-related state (must be before useEffect that references them)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeCallRef = useRef<any>(null);
  const [callActive, setCallActive] = useState(false);
  const callLogIdRef = useRef<string>("");
  const callStartTimeRef = useRef<Date | null>(null);

  // Call history type & state
  type CallLogEntry = {
    id: string;
    leadId: string;
    leadName: string;
    leadPhone: string;
    callSid: string;
    status: string;
    duration: number;
    notes: string;
    recordingUrl: string;
    startedAt: string;
    endedAt: string | null;
  };
  const [callHistory, setCallHistory] = useState<CallLogEntry[]>([]);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // Customizable keybindings
  const [customBindings, setCustomBindings] = useState<Record<string, string>>({});
  const getKey = useCallback(
    (id: string) => {
      if (customBindings[id]) return customBindings[id];
      const def = DEFAULT_KEYBINDINGS.find((kb) => kb.id === id);
      return def?.defaultKey || "";
    },
    [customBindings]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailTriggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch ALL leads (filtering is client-side for stable tab counts)
  const fetchLeads = useCallback(async () => {
    try {
      const activeProjectId = localStorage.getItem("activeProjectId");
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeProjectId) params.set("projectId", activeProjectId);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
      announce("Error loading leads");
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Client-side filter by disposition
  const filteredLeads = filter === "ALL" ? leads : leads.filter((l) => l.disposition === filter);

  // Handle lead selection and auto-highlight parallel leads
  const handleSelectLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    announce(`Selected ${lead.firstName} ${lead.lastName}`);
    
    // Auto-select N leads for parallel dialing
    const currentIndex = filteredLeads.findIndex((l) => l.id === lead.id);
    if (currentIndex !== -1) {
      const nextNLeads = filteredLeads.slice(currentIndex, currentIndex + maxParallelDials);
      setSelectedLeadIds(nextNLeads.map(l => l.id));
    }
  }, [filteredLeads, maxParallelDials]);

  useEffect(() => {
    fetchLeads();
    
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setUserProfile(data);
      })
      .catch(console.error);

    fetch("/api/user/dialer")
      .then((r) => r.json())
      .then((data) => setMaxParallelDials(data.maxParallelDials || 1))
      .catch(console.error);

    const handleProjectChange = () => {
      fetchLeads();
    };
    window.addEventListener('projectChanged', handleProjectChange);
    return () => window.removeEventListener('projectChanged', handleProjectChange);
  }, [fetchLeads]);

  // Load custom keybindings from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && data[KEYBINDINGS_SETTING_KEY]) {
          try {
            setCustomBindings(JSON.parse(data[KEYBINDINGS_SETTING_KEY]));
          } catch { /* use defaults */ }
        }
      })
      .catch(console.error);
  }, []);

  // Fetch templates
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  // Auto-register Twilio Device on mount for incoming calls
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;
    let mounted = true;

    const initDevice = async () => {
      try {
        const tokenRes = await fetch("/api/token");
        if (!tokenRes.ok) return;
        const tokenData = await tokenRes.json();

        const { Device } = await import("@twilio/voice-sdk");

        if (!deviceRef.current) {
          deviceRef.current = new Device(tokenData.token, { logLevel: 1 });
        } else {
          deviceRef.current.updateToken(tokenData.token);
        }

        const device = deviceRef.current;

        device.on("registered", () => {
          if (mounted) setDeviceReady(true);
        });

        device.on("unregistered", () => {
          if (mounted) setDeviceReady(false);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        device.on("incoming", (call: any) => {
          if (!mounted) return;
          const callerNumber = call.parameters?.From || "Unknown";
          setIncomingCall(call);
          setIncomingFrom(callerNumber);
          announce(`Incoming call from ${callerNumber}`);

          // Try to match caller to a lead
          fetch(`/api/leads?search=${encodeURIComponent(callerNumber)}`)
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data) && data.length > 0) {
                setMatchedLead(data[0]);
              } else {
                setMatchedLead(null);
              }
            })
            .catch(() => setMatchedLead(null));

          // If caller hangs up before answer
          call.on("cancel", () => {
            if (mounted) {
              setIncomingCall(null);
              setIncomingFrom("");
              setMatchedLead(null);
              setActionStatus("Missed call");
              announce("Incoming call was cancelled by the caller");
            }
          });

          call.on("disconnect", () => {
            if (mounted) {
              handleHangUp();
            }
          });
        });

        device.on("error", (err: Error) => {
          console.error("Twilio Device error:", err);
          fetch("/api/logs", {
            method: "POST",
            body: JSON.stringify({ level: "ERROR", source: "TWILIO", message: "Device error: " + err.message })
          });
        });

        // Register the device to receive incoming calls
        await device.register();

        // Refresh token every 50 minutes
        refreshTimer = setInterval(async () => {
          try {
            const res = await fetch("/api/token");
            if (res.ok) {
              const data = await res.json();
              deviceRef.current?.updateToken(data.token);
            }
          } catch { /* token refresh failed, will retry */ }
        }, 50 * 60 * 1000);

      } catch (err) {
        console.error("Failed to initialize Twilio Device:", err);
      }
    };

    initDevice();

    return () => {
      mounted = false;
      if (refreshTimer) clearInterval(refreshTimer);
      if (deviceRef.current) {
        deviceRef.current.unregister();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus trap for email modal
  useEffect(() => {
    if (!showEmailModal) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableEls[0];
    const lastFocusable = focusableEls[focusableEls.length - 1];

    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEmailModal(false);
        emailTriggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showEmailModal]);

  // Comprehensive global keyboard shortcuts (keybinding-driven)
  useEffect(() => {
    const DISPOSITION_ORDER: Disposition[] = [
      DISPOSITIONS.NEW,
      DISPOSITIONS.CALLED_NO_ANSWER,
      DISPOSITIONS.LEFT_VOICEMAIL,
      DISPOSITIONS.CALLBACK_SCHEDULED,
      DISPOSITIONS.BOOKED,
      DISPOSITIONS.NOT_INTERESTED,
      DISPOSITIONS.WRONG_NUMBER,
      DISPOSITIONS.DO_NOT_CALL,
    ];

    const STATUS_BINDING_IDS = [
      "set_new", "set_no_answer", "set_voicemail", "set_callback",
      "set_booked", "set_not_interested", "set_wrong_number", "set_dnc",
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except modifier combos)
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isInput && !e.ctrlKey && !e.altKey) return;

      // Call lead
      if (matchesKeybinding(e, getKey("call_lead")) && selectedLead) {
        e.preventDefault();
        handleCall();
        return;
      }

      // Hang up
      if (matchesKeybinding(e, getKey("hang_up")) && callActive) {
        e.preventDefault();
        handleHangUp();
        return;
      }

      // Email
      if (matchesKeybinding(e, getKey("send_email")) && selectedLead) {
        e.preventDefault();
        openEmailModal();
        return;
      }

      // Focus search
      if (matchesKeybinding(e, getKey("focus_search"))) {
        e.preventDefault();
        document.getElementById("search-leads")?.focus();
        announce("Search field focused");
        return;
      }

      // Navigation: go to pages
      if (matchesKeybinding(e, getKey("go_dashboard"))) {
        e.preventDefault();
        window.location.href = "/";
        return;
      }
      if (matchesKeybinding(e, getKey("go_history"))) {
        e.preventDefault();
        window.location.href = "/history";
        return;
      }
      if (matchesKeybinding(e, getKey("go_settings"))) {
        e.preventDefault();
        window.location.href = "/settings";
        return;
      }

      // Next / Previous lead
      if (matchesKeybinding(e, getKey("next_lead")) && filteredLeads.length > 0) {
        e.preventDefault();
        const currentIndex = selectedLead ? filteredLeads.findIndex((l) => l.id === selectedLead.id) : -1;
        const nextIndex = Math.min(currentIndex + 1, filteredLeads.length - 1);
        const nextLead = filteredLeads[nextIndex];
        handleSelectLead(nextLead);
        return;
      }
      if (matchesKeybinding(e, getKey("prev_lead")) && filteredLeads.length > 0) {
        e.preventDefault();
        const currentIndex = selectedLead ? filteredLeads.findIndex((l) => l.id === selectedLead.id) : filteredLeads.length;
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevLead = filteredLeads[prevIndex];
        handleSelectLead(prevLead);
        return;
      }

      // Edit notes
      if (matchesKeybinding(e, getKey("edit_notes")) && selectedLead) {
        e.preventDefault();
        setEditingNotes(true);
        setNotesValue(selectedLead.notes || "");
        announce("Editing notes");
        setTimeout(() => document.getElementById("notes-editor")?.focus(), 50);
        return;
      }

      // Save notes
      if (matchesKeybinding(e, getKey("save_notes")) && editingNotes) {
        e.preventDefault();
        saveNotes();
        return;
      }

      // Status shortcuts (Alt+1 through Alt+8)
      for (let i = 0; i < STATUS_BINDING_IDS.length; i++) {
        if (matchesKeybinding(e, getKey(STATUS_BINDING_IDS[i])) && selectedLead) {
          e.preventDefault();
          updateDisposition(selectedLead.id, DISPOSITION_ORDER[i]);
          return;
        }
      }

      // Import CSV
      if (matchesKeybinding(e, getKey("import_csv"))) {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      // Show shortcuts help
      if (matchesKeybinding(e, getKey("show_shortcuts"))) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        const shortcuts = DEFAULT_KEYBINDINGS.map(
          (kb) => `${kb.label}: ${formatKeyDisplay(customBindings[kb.id] || kb.defaultKey)}`
        ).join(". ");
        announce(`Keyboard shortcuts: ${shortcuts}`);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, callActive, editingNotes, filteredLeads, customBindings, getKey]);

  // Handle disposition update
  const updateDisposition = async (leadId: string, disposition: Disposition) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition }),
      });
      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      if (selectedLead?.id === leadId) setSelectedLead(updated);

      const label = DISPOSITION_LABELS[disposition];
      setActionStatus(`Status updated to ${label}`);
      announce(`Lead status updated to ${label}`);
    } catch {
      setActionStatus("Failed to update status");
      announce("Failed to update lead status");
    }
  };

  // Handle call using Twilio Voice SDK (browser-based)

  // Fetch call history and SMS history for selected lead
  useEffect(() => {
    if (selectedLead) {
      fetch(`/api/calls?leadId=${selectedLead.id}`)
        .then((r) => r.json())
        .then((data) => setCallHistory(Array.isArray(data) ? data : []))
        .catch(console.error);
      fetch(`/api/sms?leadId=${selectedLead.id}`)
        .then((r) => r.json())
        .then((data) => setSmsHistory(Array.isArray(data) ? data : []))
        .catch(console.error);
      setNotesValue(selectedLead.notes || "");
      setEditingNotes(false);
      setSmsBody("");
    } else {
      setCallHistory([]);
      setSmsHistory([]);
      setNotesValue("");
    }
  }, [selectedLead]);

  // Save notes
  const saveNotes = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? updated : l)));
      setSelectedLead(updated);
      setEditingNotes(false);
      setActionStatus("Notes saved");
      announce("Notes saved");
    } catch {
      setActionStatus("Failed to save notes");
    }
  };

  const handleHangUp = () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
    activeCallRef.current = null;
    setCallActive(false);
    setCalling(false);

    // Update call log with end time
    if (callLogIdRef.current && callStartTimeRef.current) {
      const duration = Math.round((Date.now() - callStartTimeRef.current.getTime()) / 1000);
      fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: callLogIdRef.current,
          status: "completed",
          duration,
          endedAt: new Date().toISOString(),
        }),
      }).then(() => {
        if (selectedLead) {
          fetch(`/api/calls?leadId=${selectedLead.id}`)
            .then((r) => r.json())
            .then((data) => setCallHistory(Array.isArray(data) ? data : []))
            .catch(console.error);
        }
      }).catch(console.error);
      callLogIdRef.current = "";
      callStartTimeRef.current = null;
    }

    setActionStatus("Call ended");
    announce("Call ended");
  };

  const handleCall = async () => {
    if (!selectedLead?.phone) {
      setActionStatus("No phone number available");
      announce("Cannot call: no phone number available for this lead");
      return;
    }

    // If a call is already active, hang up
    if (callActive) {
      handleHangUp();
      return;
    }

    setCalling(true);
    setActionStatus("Connecting call...");
    announce(`Calling ${selectedLead.firstName} ${selectedLead.lastName} at ${selectedLead.phone}`);

    if (selectedLeadIds.length > 1) {
      // Parallel Dialer logic
      if (!userProfile) return;

      setCalling(true);
      setActionStatus(`Connecting Parallel Dial (${selectedLeadIds.length} leads)...`);
      announce(`Connecting parallel dial for ${selectedLeadIds.length} leads.`);

      try {
        const tokenRes = await fetch("/api/token");
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
          throw new Error(tokenData.error || "Failed to get Twilio token");
        }

        const { Device } = await import("@twilio/voice-sdk");

        if (!deviceRef.current) {
          deviceRef.current = new Device(tokenData.token, { logLevel: 1 });
          await deviceRef.current.register();
        } else {
          deviceRef.current.updateToken(tokenData.token);
        }

        const device = deviceRef.current;
        const params = { To: `ParallelDial_${userProfile.userId}` };
        
        fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "INFO", source: "FRONTEND", message: "Initiating ParallelDial WebRTC connection" }) });

        // Connect to conference bridge
        const call = await device.connect({ params });
        activeCallRef.current = call;

        call.on("accept", async () => {
          fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "INFO", source: "FRONTEND", message: "WebRTC accepted, triggering parallel REST calls" }) });
          setCallActive(true);
          // Once in the conference, launch the outbound REST calls
          try {
            const res = await fetch("/api/call/parallel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leadIds: selectedLeadIds })
            });
            const data = await res.json();
            
            if (res.ok) {
              setActionStatus(`Parallel dialing ${data.initiatedCalls} leads. Waiting for answer...`);
            } else {
              throw new Error(data.error || "Failed to initiate calls");
            }
          } catch (e: any) {
            fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "ERROR", source: "FRONTEND", message: "Failed to start parallel calls: " + e.message }) });
            setActionStatus(`Error starting parallel calls: ${e.message}`);
            handleHangUp();
          }
        });

        call.on("disconnect", () => {
          fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "INFO", source: "FRONTEND", message: "Parallel call disconnected" }) });
          handleHangUp();
        });
        call.on("cancel", () => {
          fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "WARN", source: "FRONTEND", message: "Parallel call canceled" }) });
          handleHangUp();
        });
        call.on("reject", () => {
          fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "ERROR", source: "FRONTEND", message: "Parallel call rejected" }) });
          setActionStatus("Call rejected by server");
          handleHangUp();
        });
        call.on("error", (err: any) => {
          console.error("Twilio Call error:", err);
          fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "ERROR", source: "TWILIO", message: "Call error: " + err.message }) });
          setActionStatus("Call error: " + err.message);
          handleHangUp();
        });

      } catch (err: any) {
        fetch("/api/logs", { method: "POST", body: JSON.stringify({ level: "ERROR", source: "FRONTEND", message: "Exception starting parallel dial: " + err.message }) });
        setCalling(false);
        setActionStatus(err.message || "Failed to start parallel call");
        announce(err.message || "Failed to start parallel call");
      }
      return;
    }

    // Standard single dial logic
    try {
      // Get access token
      const tokenRes = await fetch("/api/token");
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        setActionStatus(tokenData.error || "Failed to get call token");
        announce(tokenData.error || "Failed to get call token");
        setCalling(false);
        return;
      }

      // Import Twilio Voice SDK dynamically (client-side only)
      const { Device } = await import("@twilio/voice-sdk");

      // Initialize device if needed
      if (!deviceRef.current) {
        deviceRef.current = new Device(tokenData.token, {
          logLevel: 1,
        });
      } else {
        // Update token
        deviceRef.current.updateToken(tokenData.token);
      }

      // Make the call
      const call = await deviceRef.current.connect({
        params: { To: selectedLead.phone },
      });

      activeCallRef.current = call;
      callStartTimeRef.current = new Date();
      setCallActive(true);
      setActionStatus("Call connected — speaking through browser");
      announce("Call connected. You are now speaking through your browser.");

      // Create call log entry (NO auto-disposition change)
      try {
        const logRes = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: selectedLead.id,
            leadName: `${selectedLead.firstName} ${selectedLead.lastName}`,
            leadPhone: selectedLead.phone,
            callSid: call.parameters?.CallSid || "",
            status: "in-progress",
          }),
        });
        const logData = await logRes.json();
        callLogIdRef.current = logData.id || "";
      } catch { /* non-critical */ }

      call.on("disconnect", () => {
        handleHangUp();
      });

      call.on("cancel", () => {
        activeCallRef.current = null;
        setCallActive(false);
        setCalling(false);
        setActionStatus("Call cancelled");
        announce("Call cancelled");
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Call failed";
      setActionStatus(`Call failed: ${message}`);
      announce("Call failed. Check your Twilio settings.");
      setCalling(false);
      setCallActive(false);
    }
  };

  // DTMF digit map for the dialpad UI
  const DIALPAD_KEYS = [
    { digit: "1", sub: "" },
    { digit: "2", sub: "ABC" },
    { digit: "3", sub: "DEF" },
    { digit: "4", sub: "GHI" },
    { digit: "5", sub: "JKL" },
    { digit: "6", sub: "MNO" },
    { digit: "7", sub: "PQRS" },
    { digit: "8", sub: "TUV" },
    { digit: "9", sub: "WXYZ" },
    { digit: "*", sub: "" },
    { digit: "0", sub: "+" },
    { digit: "#", sub: "" },
  ];

  // Send DTMF tone during active call
  const handleSendDtmf = (digit: string) => {
    if (activeCallRef.current) {
      activeCallRef.current.sendDigits(digit);
      setLastDtmfDigit(digit);
      setTimeout(() => setLastDtmfDigit(""), 300);
    }
  };

  // Dial any number via standalone dialer (reuses Device)
  const handleDialerCall = async () => {
    const cleanNumber = dialerNumber.replace(/[^0-9+*#]/g, "");
    if (!cleanNumber) {
      setActionStatus("Enter a phone number to dial");
      announce("Cannot call: no phone number entered");
      return;
    }
    if (callActive) {
      handleHangUp();
      return;
    }
    setCalling(true);
    setActionStatus(`Dialing ${cleanNumber}...`);
    announce(`Dialing ${cleanNumber}`);
    try {
      const tokenRes = await fetch("/api/token");
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        setActionStatus(tokenData.error || "Failed to get call token");
        announce(tokenData.error || "Failed to get call token");
        setCalling(false);
        return;
      }
      const { Device } = await import("@twilio/voice-sdk");
      if (!deviceRef.current) {
        deviceRef.current = new Device(tokenData.token, { logLevel: 1 });
      } else {
        deviceRef.current.updateToken(tokenData.token);
      }
      const call = await deviceRef.current.connect({
        params: { To: cleanNumber },
      });
      activeCallRef.current = call;
      callStartTimeRef.current = new Date();
      setCallActive(true);
      setActionStatus(`Connected to ${cleanNumber}`);
      announce("Call connected through your browser.");

      // Log the dialer call (no leadId)
      try {
        const logRes = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: null,
            leadName: "Manual Dial",
            leadPhone: cleanNumber,
            callSid: call.parameters?.CallSid || "",
            status: "in-progress",
          }),
        });
        const logData = await logRes.json();
        callLogIdRef.current = logData.id || "";
      } catch { /* non-critical */ }

      call.on("disconnect", () => handleHangUp());
      call.on("cancel", () => {
        activeCallRef.current = null;
        setCallActive(false);
        setCalling(false);
        setActionStatus("Call cancelled");
        announce("Call cancelled");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Call failed";
      setActionStatus(`Call failed: ${message}`);
      announce("Call failed. Check your Twilio settings.");
      setCalling(false);
      setCallActive(false);
    }
  };

  // Append digit to dialer number
  const handleDialerDigit = (digit: string) => {
    setDialerNumber((prev) => prev + digit);
  };

  // Open email modal
  const openEmailModal = () => {
    if (!selectedLead?.email) {
      setActionStatus("No email address available");
      announce("Cannot email: no email address for this lead");
      return;
    }
    setShowEmailModal(true);
    setEmailSubject("");
    setEmailBody("");
    setSelectedTemplate("");
  };

  // Send SMS
  const handleSendSms = async () => {
    if (!selectedLead?.phone || !smsBody.trim()) {
      setActionStatus("Phone number and message are required");
      announce("Cannot send text: phone number and message are required");
      return;
    }

    setSendingSms(true);
    setActionStatus("Sending text message...");
    announce(`Sending text to ${selectedLead.firstName} ${selectedLead.lastName}`);

    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedLead.phone,
          body: smsBody,
          leadId: selectedLead.id,
          leadName: `${selectedLead.firstName} ${selectedLead.lastName}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionStatus(data.error || "Text failed to send");
        announce(data.error || "Text failed to send");
        return;
      }

      setActionStatus("Text sent successfully");
      announce("Text message sent successfully");
      setSmsBody("");

      // Refresh SMS history
      fetch(`/api/sms?leadId=${selectedLead.id}`)
        .then((r) => r.json())
        .then((data) => setSmsHistory(Array.isArray(data) ? data : []))
        .catch(console.error);
    } catch {
      setActionStatus("Text failed — check Twilio settings");
      announce("Text failed to send. Check your Twilio settings.");
    } finally {
      setSendingSms(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template && selectedLead) {
      setEmailSubject(mergeTemplate(template.subject, selectedLead));
      setEmailBody(mergeTemplate(template.body, selectedLead));
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!selectedLead || !emailSubject || !emailBody) return;

    setSendingEmail(true);
    announce(`Sending email to ${selectedLead.email}`);

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedLead.email,
          subject: emailSubject,
          body: emailBody,
          leadId: selectedLead.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionStatus(data.error || "Email failed");
        announce(data.error || "Email failed to send");
        return;
      }

      setActionStatus("Email sent successfully");
      announce("Email sent successfully");
      setShowEmailModal(false);
      emailTriggerRef.current?.focus();
    } catch {
      setActionStatus("Email failed — check Gmail settings");
      announce("Email failed to send. Check your Gmail settings.");
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle CSV import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionStatus("Importing leads...");
    announce("Importing leads from CSV file");

    const formData = new FormData();
    formData.append("file", file);
    const activeProjectId = localStorage.getItem("activeProjectId");
    if (activeProjectId) {
      formData.append("projectId", activeProjectId);
    }

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setActionStatus(data.error || "Import failed");
        announce("Import failed");
        return;
      }

      setActionStatus(`Imported ${data.imported} leads`);
      announce(`Successfully imported ${data.imported} leads`);
      fetchLeads();
    } catch {
      setActionStatus("Import failed");
      announce("Import failed. Check your CSV file format.");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle lead row keyboard navigation
  const handleLeadKeyDown = (e: React.KeyboardEvent, lead: Lead) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedLead(lead);
      announce(
        `Selected ${lead.firstName} ${lead.lastName}${lead.company ? ` from ${lead.company}` : ""}`
      );
    }
  };

  // Delete all leads
  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete ALL leads? This cannot be undone.")) return;

    try {
      // Delete each lead
      for (const lead of leads) {
        await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      }
      setLeads([]);
      setSelectedLead(null);
      setActionStatus("All leads deleted");
      announce("All leads deleted");
    } catch {
      setActionStatus("Failed to delete leads");
      announce("Failed to delete leads");
    }
  };

  // Handle incoming call answer
  const handleAnswerIncoming = () => {
    if (!incomingCall) return;
    incomingCall.accept();
    activeCallRef.current = incomingCall;
    callStartTimeRef.current = new Date();
    setCallActive(true);
    setCalling(true);
    setActionStatus(`Connected to ${incomingFrom}`);
    announce(`Answered call from ${incomingFrom}`);

    // If we matched a lead, select them
    if (matchedLead) {
      setSelectedLead(matchedLead);
    }

    // Log the incoming call
    fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: matchedLead?.id || null,
        leadName: matchedLead ? `${matchedLead.firstName} ${matchedLead.lastName}` : "Incoming Call",
        leadPhone: incomingFrom,
        callSid: incomingCall.parameters?.CallSid || "",
        status: "in-progress",
      }),
    })
      .then((r) => r.json())
      .then((data) => { callLogIdRef.current = data.id || ""; })
      .catch(() => { /* non-critical */ });

    setIncomingCall(null);
    setIncomingFrom("");
    setMatchedLead(null);
  };

  // Handle incoming call reject
  const handleRejectIncoming = () => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
    setIncomingFrom("");
    setMatchedLead(null);
    setActionStatus("Call rejected");
    announce("Incoming call rejected");
  };

  return (
    <>
      {/* Incoming call notification banner */}
      {incomingCall && (
        <div className="incoming-call-banner" role="alert" aria-live="assertive">
          <span className="incoming-call-ring-icon">📞</span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Incoming Call
            </div>
            <div style={{ fontSize: "1rem", color: "var(--color-text-secondary)", fontFamily: "monospace", marginTop: "2px" }}>
              {incomingFrom || "Unknown Number"}
            </div>
            {matchedLead && (
              <div style={{ marginTop: "6px", textAlign: "left", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px 14px" }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-accent)", marginBottom: "4px" }}>
                  {matchedLead.firstName} {matchedLead.lastName}
                </div>
                {matchedLead.company && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    🏢 {matchedLead.company}
                  </div>
                )}
                {matchedLead.email && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    ✉️ {matchedLead.email}
                  </div>
                )}
                {(matchedLead.city || matchedLead.state) && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    📍 {[matchedLead.city, matchedLead.state].filter(Boolean).join(", ")}
                  </div>
                )}
                {matchedLead.notes && (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", fontStyle: "italic" }}>
                    📝 {matchedLead.notes.length > 80 ? matchedLead.notes.slice(0, 80) + "..." : matchedLead.notes}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className="btn btn-success"
              onClick={handleAnswerIncoming}
              style={{ fontSize: "1rem", padding: "12px 28px" }}
              aria-label="Answer incoming call"
            >
              ✅ Answer
            </button>
            <button
              className="btn btn-danger"
              onClick={handleRejectIncoming}
              style={{ fontSize: "1rem", padding: "12px 28px" }}
              aria-label="Reject incoming call"
            >
              ❌ Reject
            </button>
          </div>
        </div>
      )}

    <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
      {/* Left panel: Lead list */}
      <section
        aria-label="Lead list"
        style={{
          flex: "1 1 55%",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--color-border)",
          minWidth: 0,
        }}
      >
        {/* Toolbar */}
        <div
          role="toolbar"
          aria-label="Lead list controls"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-secondary)",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 200px", minWidth: "150px" }}>
            <label htmlFor="search-leads" className="sr-only">
              Search leads
            </label>
            <input
              id="search-leads"
              type="search"
              className="form-input"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search leads by name, company, email, or phone"
            />
          </div>

          {/* Import */}
          <div>
            <label htmlFor="csv-import" className="btn btn-primary" style={{ cursor: "pointer" }}>
              Import CSV
            </label>
            <input
              ref={fileInputRef}
              id="csv-import"
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="sr-only"
              aria-label="Upload a CSV file to import leads"
            />
          </div>

          {/* Delete all */}
          {leads.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleDeleteAll}
              style={{ fontSize: "0.8125rem", padding: "8px 14px" }}
            >
              Clear All
            </button>
          )}

          {/* Lead count */}
          <span
            aria-live="polite"
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-muted)",
              fontWeight: 600,
            }}
          >
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Status Tabs */}
        <div
          role="tablist"
          aria-label="Filter by status"
          style={{
            display: "flex",
            gap: "0",
            padding: "0",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-secondary)",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <button
            role="tab"
            aria-selected={filter === "ALL"}
            onClick={() => setFilter("ALL")}
            style={{
              flex: "1 1 auto",
              padding: "10px 12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              border: "none",
              borderBottom: filter === "ALL" ? "2px solid var(--color-accent)" : "2px solid transparent",
              backgroundColor: filter === "ALL" ? "var(--color-bg-primary)" : "transparent",
              color: filter === "ALL" ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: "pointer",
              textAlign: "center",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            All ({leads.length})
          </button>
          {Object.entries(DISPOSITION_LABELS).map(([key, label]) => {
            const count = leads.filter(l => l.disposition === key).length;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                style={{
                  flex: "1 1 auto",
                  padding: "10px 8px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  border: "none",
                  borderBottom: filter === key ? "2px solid var(--color-accent)" : "2px solid transparent",
                  backgroundColor: filter === key ? "var(--color-bg-primary)" : "transparent",
                  color: filter === key ? "var(--color-accent)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  opacity: count === 0 ? 0.4 : 1,
                }}
              >
                {label} {count > 0 && <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Lead table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {loading ? (
            <div
              role="status"
              aria-busy="true"
              style={{
                padding: "48px",
                textAlign: "center",
                color: "var(--color-text-muted)",
              }}
            >
              Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                color: "var(--color-text-muted)",
              }}
            >
              <p style={{ fontSize: "1.125rem", marginBottom: "8px" }}>No leads yet</p>
              <p>Import a CSV file to get started.</p>
            </div>
          ) : (
            <table className="lead-table" aria-label="Leads">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "40px" }}></th>
                  <th scope="col">Name</th>
                  <th scope="col">Company</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const isChecked = selectedLeadIds.includes(lead.id);
                  return (
                  <tr
                    key={lead.id}
                    tabIndex={0}
                    role="row"
                    aria-current={selectedLead?.id === lead.id ? "true" : undefined}
                    aria-selected={isChecked}
                    onClick={() => handleSelectLead(lead)}
                    onKeyDown={(e) => handleLeadKeyDown(e, lead)}
                    aria-label={`${lead.firstName} ${lead.lastName}, ${lead.company || "no company"}, ${DISPOSITION_LABELS[lead.disposition as Disposition] || lead.disposition}`}
                    style={isChecked ? { backgroundColor: "var(--color-bg-selected)", borderLeft: "4px solid var(--color-accent)" } : {}}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedLeadIds.length === 0) {
                              handleSelectLead(lead);
                            } else {
                              setSelectedLeadIds(prev => [...prev, lead.id]);
                            }
                          } else {
                            setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                          }
                        }}
                        style={{ width: "16px", height: "16px", accentColor: "var(--color-blue)", cursor: "pointer" }}
                        aria-label={`Select ${lead.firstName}`}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td style={{ color: "var(--color-text-secondary)" }}>
                      {lead.company || "—"}
                    </td>
                    <td style={{ color: "var(--color-text-secondary)", fontFamily: "monospace" }}>
                      {lead.phone || "—"}
                    </td>
                    <td>
                      <span
                        className={`badge ${DISPOSITION_COLORS[lead.disposition as Disposition] || "bg-gray-600 text-white"}`}
                      >
                        {DISPOSITION_LABELS[lead.disposition as Disposition] || lead.disposition}
                      </span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Right panel: Lead detail */}
      <aside
        aria-label="Lead details"
        style={{
          flex: "1 1 45%",
          overflow: "auto",
          padding: "24px",
          backgroundColor: "var(--color-bg-primary)",
          minWidth: 0,
        }}
      >
        {!selectedLead ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--color-text-muted)",
              textAlign: "center",
              gap: "24px",
            }}
          >
            <div>
              <p style={{ fontSize: "1.25rem", marginBottom: "8px" }}>No Lead Selected</p>
              <p>Select a lead from the list to see details and take action.</p>
              <p style={{ fontSize: "0.8125rem", marginTop: "16px" }}>
                <kbd style={{ padding: "2px 8px", background: "var(--color-bg-tertiary)", borderRadius: "4px", fontSize: "0.75rem" }}>Tab</kbd> to navigate •{" "}
                <kbd style={{ padding: "2px 8px", background: "var(--color-bg-tertiary)", borderRadius: "4px", fontSize: "0.75rem" }}>Enter</kbd> to select
              </p>
            </div>

            {/* Standalone Dialer — always available */}
            <div className="card" style={{ width: "100%", maxWidth: "340px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 12px", textAlign: "center" }}>
                📞 Dial a Number
              </h3>
              {actionStatus && (
                <div
                  role="status"
                  aria-live="assertive"
                  style={{
                    padding: "8px 12px",
                    marginBottom: "12px",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    backgroundColor: actionStatus.includes("fail") || actionStatus.includes("error") || actionStatus.includes("Error")
                      ? "rgba(238, 68, 68, 0.15)" : "rgba(68, 187, 102, 0.15)",
                    color: actionStatus.includes("fail") || actionStatus.includes("error") || actionStatus.includes("Error")
                      ? "#ff6666" : "#66dd88",
                  }}
                >
                  {actionStatus}
                </div>
              )}
              <input
                className="dialer-number-input"
                type="tel"
                value={dialerNumber}
                onChange={(e) => setDialerNumber(e.target.value)}
                placeholder="Enter phone number"
                aria-label="Phone number to dial"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDialerCall();
                  }
                }}
              />
              <div className="dialpad" style={{ marginTop: "12px" }}>
                {DIALPAD_KEYS.map((key) => (
                  <button
                    key={key.digit}
                    className="dialpad-btn"
                    onClick={() => handleDialerDigit(key.digit)}
                    aria-label={`Dial digit ${key.digit}`}
                  >
                    {key.digit}
                    {key.sub && <span className="dialpad-sub">{key.sub}</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setDialerNumber((prev) => prev.slice(0, -1))}
                  disabled={!dialerNumber}
                  style={{ flex: "0 0 auto", fontSize: "1rem", padding: "12px 18px" }}
                  aria-label="Backspace"
                >
                  ⌫
                </button>
                <button
                  className={callActive ? "btn btn-danger" : "btn btn-success"}
                  onClick={callActive ? handleHangUp : handleDialerCall}
                  disabled={!callActive && (calling || !dialerNumber.trim())}
                  style={{ flex: 1, fontSize: "1rem", padding: "12px 20px" }}
                  aria-label={callActive ? "Hang up" : `Call ${dialerNumber}`}
                >
                  {calling ? (callActive ? "🔴 Hang Up" : "Connecting...") : "📞 Call"}
                </button>
              </div>
              {/* DTMF pad during active dialer call */}
              {callActive && (
                <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, margin: "0 0 8px", textAlign: "center", color: "var(--color-text-secondary)" }}>
                    🔢 DTMF Tones
                  </h4>
                  {lastDtmfDigit && (
                    <div style={{ textAlign: "center", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-accent)", marginBottom: "6px" }}>
                      {lastDtmfDigit}
                    </div>
                  )}
                  <div className="dialpad">
                    {DIALPAD_KEYS.map((key) => (
                      <button
                        key={`dtmf-${key.digit}`}
                        className="dialpad-btn"
                        onClick={() => handleSendDtmf(key.digit)}
                        aria-label={`Send DTMF tone ${key.digit}`}
                      >
                        {key.digit}
                        {key.sub && <span className="dialpad-sub">{key.sub}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Status announcement */}
            {actionStatus && (
              <div
                role="status"
                aria-live="assertive"
                style={{
                  padding: "10px 16px",
                  marginBottom: "16px",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  backgroundColor: actionStatus.includes("fail") || actionStatus.includes("error") || actionStatus.includes("Error") || actionStatus.includes("Cannot")
                    ? "rgba(238, 68, 68, 0.15)"
                    : "rgba(68, 187, 102, 0.15)",
                  color: actionStatus.includes("fail") || actionStatus.includes("error") || actionStatus.includes("Error") || actionStatus.includes("Cannot")
                    ? "#ff6666"
                    : "#66dd88",
                  border: `1px solid ${actionStatus.includes("fail") || actionStatus.includes("error") || actionStatus.includes("Error") || actionStatus.includes("Cannot") ? "rgba(238, 68, 68, 0.3)" : "rgba(68, 187, 102, 0.3)"}`,
                }}
              >
                {actionStatus}
              </div>
            )}

            {/* Lead header */}
            <div className="card" style={{ marginBottom: "16px" }}>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  marginBottom: "4px",
                  margin: 0,
                }}
              >
                {selectedLead.firstName} {selectedLead.lastName}
              </h2>
              {selectedLead.company && (
                <p
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "1rem",
                    margin: "4px 0 12px",
                  }}
                >
                  {selectedLead.company}
                </p>
              )}

              {/* Contact details */}
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "8px 16px",
                  margin: 0,
                  fontSize: "0.9375rem",
                }}
              >
                {selectedLead.phone && (
                  <>
                    <dt style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Phone</dt>
                    <dd style={{ margin: 0, fontFamily: "monospace" }}>{selectedLead.phone}</dd>
                  </>
                )}
                {selectedLead.email && (
                  <>
                    <dt style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Email</dt>
                    <dd style={{ margin: 0 }}>{selectedLead.email}</dd>
                  </>
                )}
                {(selectedLead.city || selectedLead.state) && (
                  <>
                    <dt style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Location</dt>
                    <dd style={{ margin: 0 }}>
                      {[selectedLead.city, selectedLead.state].filter(Boolean).join(", ")}
                    </dd>
                  </>
                )}
                {selectedLead.website && (
                  <>
                    <dt style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Website</dt>
                    <dd style={{ margin: 0 }}>
                      <a
                        href={
                          selectedLead.website.startsWith("http")
                            ? selectedLead.website
                            : `https://${selectedLead.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {selectedLead.website}
                      </a>
                    </dd>
                  </>
                )}
                {selectedLead.notes && (
                  <>
                    <dt style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Notes</dt>
                    <dd style={{ margin: 0 }}>{selectedLead.notes}</dd>
                  </>
                )}
              </dl>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <button
                className="btn btn-success"
                onClick={handleCall}
                disabled={calling && !callActive || !selectedLead.phone}
                aria-label={`${callActive ? 'Hang up' : 'Call'} ${selectedLead.firstName} ${selectedLead.lastName} at ${selectedLead.phone || "no number"}. Keyboard shortcut: ${formatKeyDisplay(getKey(callActive ? 'hang_up' : 'call_lead'))}`}
                style={{ flex: 1, fontSize: "1rem", padding: "14px 20px" }}
                aria-keyshortcuts={getKey(callActive ? 'hang_up' : 'call_lead')}
              >
                {calling ? (callActive ? "🔴 Hang Up" : "Connecting...") : "📞 Call Now"}
              </button>

              <button
                ref={emailTriggerRef}
                className="btn btn-primary"
                onClick={openEmailModal}
                disabled={!selectedLead.email}
                aria-label={`Send email to ${selectedLead.firstName} ${selectedLead.lastName} at ${selectedLead.email || "no email"}. Keyboard shortcut: Control plus Shift plus E`}
                style={{ flex: 1, fontSize: "1rem", padding: "14px 20px" }}
                aria-keyshortcuts="Control+Shift+E"
              >
                ✉️ Send Email
              </button>

              <button
                className="btn btn-primary"
                onClick={() => document.getElementById("sms-compose")?.focus()}
                disabled={!selectedLead.phone}
                aria-label={`Send text to ${selectedLead.firstName} ${selectedLead.lastName} at ${selectedLead.phone || "no number"}`}
                style={{ flex: 1, fontSize: "1rem", padding: "14px 20px", backgroundColor: "#8b5cf6" }}
              >
                💬 Send Text
              </button>
            </div>

            {/* DTMF Numberpad — shown only during active call */}
            {callActive && (
              <div className="card" style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 12px", textAlign: "center" }}>
                  🔢 Dialpad (DTMF)
                </h3>
                {lastDtmfDigit && (
                  <div style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)", marginBottom: "8px", minHeight: "2rem" }}>
                    {lastDtmfDigit}
                  </div>
                )}
                <div className="dialpad">
                  {DIALPAD_KEYS.map((key) => (
                    <button
                      key={key.digit}
                      className="dialpad-btn"
                      onClick={() => handleSendDtmf(key.digit)}
                      aria-label={`Send DTMF tone ${key.digit}`}
                    >
                      {key.digit}
                      {key.sub && <span className="dialpad-sub">{key.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                textAlign: "center",
                marginBottom: "16px",
              }}
            >
              <kbd style={{ padding: "2px 6px", background: "var(--color-bg-tertiary)", borderRadius: "4px" }}>{formatKeyDisplay(getKey('call_lead'))}</kbd> Call •{" "}
              <kbd style={{ padding: "2px 6px", background: "var(--color-bg-tertiary)", borderRadius: "4px" }}>{formatKeyDisplay(getKey('hang_up'))}</kbd> Hang Up •{" "}
              <kbd style={{ padding: "2px 6px", background: "var(--color-bg-tertiary)", borderRadius: "4px" }}>{formatKeyDisplay(getKey('send_email'))}</kbd> Email •{" "}
              <kbd style={{ padding: "2px 6px", background: "var(--color-bg-tertiary)", borderRadius: "4px" }}>Shift+?</kbd> All Shortcuts
            </p>

            {/* Disposition buttons */}
            <div className="card">
              <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", margin: "0 0 12px" }}>
                Update Status
              </h3>
              <div
                role="group"
                aria-label="Lead disposition options"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {Object.entries(DISPOSITIONS).map(([key, value]) => (
                  <button
                    key={key}
                    className={`btn btn-secondary ${selectedLead.disposition === value ? "active" : ""}`}
                    onClick={() => updateDisposition(selectedLead.id, value)}
                    aria-pressed={selectedLead.disposition === value}
                    style={{
                      fontSize: "0.8125rem",
                      padding: "10px 12px",
                      textAlign: "center",
                      borderColor:
                        selectedLead.disposition === value
                          ? "var(--color-accent)"
                          : "var(--color-border)",
                      backgroundColor:
                        selectedLead.disposition === value
                          ? "var(--color-bg-selected)"
                          : undefined,
                    }}
                  >
                    {DISPOSITION_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="card" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, margin: 0 }}>
                  📝 Notes
                </h3>
                {!editingNotes ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditingNotes(true)}
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="btn btn-success"
                      onClick={saveNotes}
                      style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setEditingNotes(false); setNotesValue(selectedLead.notes || ""); }}
                      style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {editingNotes ? (
                <textarea
                  id="notes-editor"
                  className="form-input"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this lead..."
                  aria-label="Lead notes editor. Press Ctrl plus Enter to save."
                  style={{ resize: "vertical", fontSize: "0.8125rem" }}
                />
              ) : (
                <p style={{ fontSize: "0.8125rem", color: notesValue ? "var(--color-text-secondary)" : "var(--color-text-muted)", margin: 0, whiteSpace: "pre-wrap" }}>
                  {notesValue || "No notes yet. Click Edit to add some."}
                </p>
              )}
            </div>

            {/* Call History */}
            <div className="card" style={{ marginTop: "16px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", margin: "0 0 12px" }}>
                📞 Call History
              </h3>
              {callHistory.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", margin: 0 }}>
                  No calls yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {callHistory.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border)",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>
                          {new Date(entry.startedAt).toLocaleDateString()} {new Date(entry.startedAt).toLocaleTimeString()}
                        </span>
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: entry.status === "completed" ? "rgba(68, 187, 102, 0.15)" : "rgba(238, 187, 68, 0.15)",
                          color: entry.status === "completed" ? "#66dd88" : "#ddbb44",
                        }}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.duration > 0 && (
                        <div style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>
                          Duration: {Math.floor(entry.duration / 60)}m {entry.duration % 60}s
                        </div>
                      )}
                      {entry.recordingUrl && (
                        <div style={{ marginTop: "8px" }}>
                          <audio
                            controls
                            preload="none"
                            src={`/api/recording/${entry.id}`}
                            style={{
                              width: "100%",
                              height: "32px",
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Text Messages */}
            <div className="card" style={{ marginTop: "16px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", margin: "0 0 12px" }}>
                💬 Text Messages
              </h3>

              {/* Compose */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <textarea
                  id="sms-compose"
                  className="form-input"
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  rows={2}
                  placeholder={selectedLead.phone ? "Type a text message..." : "No phone number available"}
                  disabled={!selectedLead.phone}
                  aria-label="Compose text message"
                  style={{ resize: "vertical", fontSize: "0.8125rem", flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      e.preventDefault();
                      handleSendSms();
                    }
                  }}
                />
                <button
                  className="btn btn-success"
                  onClick={handleSendSms}
                  disabled={sendingSms || !smsBody.trim() || !selectedLead.phone}
                  style={{ alignSelf: "flex-end", fontSize: "0.8125rem", padding: "10px 16px" }}
                  aria-label={sendingSms ? "Sending text" : "Send text message"}
                >
                  {sendingSms ? "Sending..." : "Send"}
                </button>
              </div>
              <p style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginBottom: "12px" }}>
                Press <kbd style={{ padding: "1px 4px", background: "var(--color-bg-tertiary)", borderRadius: "3px", fontSize: "0.625rem" }}>Ctrl+Enter</kbd> to send
              </p>

              {/* SMS History */}
              {smsHistory.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", margin: 0 }}>
                  No text messages yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {smsHistory.map((sms) => (
                    <div
                      key={sms.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border)",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600 }}>
                          {new Date(sms.sentAt).toLocaleDateString()} {new Date(sms.sentAt).toLocaleTimeString()}
                        </span>
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(139, 92, 246, 0.15)",
                          color: "#a78bfa",
                        }}>
                          {sms.status}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: "var(--color-text-secondary)", whiteSpace: "pre-wrap" }}>
                        {sms.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Email compose modal */}
      {showEmailModal && selectedLead && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Send email to ${selectedLead.firstName} ${selectedLead.lastName}`}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEmailModal(false);
              emailTriggerRef.current?.focus();
            }
          }}
        >
          <div
            ref={modalRef}
            className="card"
            style={{
              width: "90%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px" }}>
              Email {selectedLead.firstName} {selectedLead.lastName}
            </h2>

            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Sending to: <strong>{selectedLead.email}</strong>
            </p>

            {/* Template selector */}
            {templates.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="email-template" className="form-label">
                  Use Template
                </label>
                <select
                  id="email-template"
                  className="form-input"
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                >
                  <option value="">— Select a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="email-subject" className="form-label">
                Subject <span aria-hidden="true">*</span>
              </label>
              <input
                id="email-subject"
                type="text"
                className="form-input"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                aria-required="true"
                placeholder="Email subject line"
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="email-body" className="form-label">
                Body <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="email-body"
                className="form-input"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                aria-required="true"
                rows={8}
                placeholder="Email body. Use merge fields like {{first_name}}, {{company}}, {{casual_name}}, {{city}}, {{state}}"
                style={{ resize: "vertical" }}
              />
            </div>

            {/* Merge fields hint */}
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
              Available merge fields: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company}}"}, {"{{casual_name}}"}, {"{{city}}"}, {"{{state}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{website}}"}
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowEmailModal(false);
                  emailTriggerRef.current?.focus();
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailSubject || !emailBody}
                aria-label={sendingEmail ? "Sending email" : "Send email now"}
              >
                {sendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts reference"
          onClick={() => setShowShortcutsModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                ⌨️ Keyboard Shortcuts
              </h2>
              <button
                className="btn btn-secondary"
                onClick={() => setShowShortcutsModal(false)}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                Close (Esc)
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
              Customize these in Settings → Keybindings
            </p>
            {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
              const bindings = DEFAULT_KEYBINDINGS.filter((kb) => kb.category === catKey);
              if (bindings.length === 0) return null;
              return (
                <div key={catKey} style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-accent)", marginBottom: "6px" }}>
                    {catLabel}
                  </h3>
                  {bindings.map((kb) => (
                    <div
                      key={kb.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <span style={{ fontSize: "0.8125rem" }}>{kb.label}</span>
                      <kbd style={{
                        padding: "3px 8px",
                        background: "var(--color-bg-tertiary)",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}>
                        {formatKeyDisplay(customBindings[kb.id] || kb.defaultKey)}
                      </kbd>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
