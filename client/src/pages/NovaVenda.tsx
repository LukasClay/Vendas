import { useAuth } from "@/_core/hooks/useAuth";
import {
  applyClientAutofill,
  editAutofilledClientDetails,
  editAutofilledClientName,
  type ClientAutofillSnapshot,
} from "@/lib/clientAutofill";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2,
  Upload,
  X,
  FileText,
  Loader2,
  Star,
  Camera,
  Calendar,
  Clock,
  ChevronDown,
  ImagePlus,
} from "lucide-react";
import {
  COUNTRIES,
  applyPhoneMask,
  parsePhoneForInput,
  type CountryPhone,
} from "@/lib/phoneCountries";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { TYPES_WITH_PHOTOS } from "@shared/const";

const CONSULTA_CARTAS = "Consulta Cartas";
type ClientSearchSource = "name" | "phone";

function canSearchClientTerm(
  source: ClientSearchSource,
  term: string
): boolean {
  const length = term.trim().length;
  const minimum = source === "phone" ? 4 : 2;
  return length >= minimum && length <= 100;
}

// Retorna a data de hoje no fuso local (evita bug das 21h com UTC)
function getLocalToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

// Formata string "YYYY-MM-DD" para "DD/MM/AAAA"
function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const match = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(d);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

// Converte "DD/MM/AAAA" → "YYYY-MM-DD" para salvar no estado interno
function parseDateMask(masked: string): string {
  const m = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Aplica máscara dd/mm/aaaa a partir de dígitos puros
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseCurrencyToNumber(formatted: string): number {
  const clean = formatted.replace(/[R$\s.]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

const inputStyle = {
  border: "1.5px solid #ddd5c4",
  background: "#faf8f4",
  color: "#1a1a2e",
};

const labelStyle = { color: "#2a2a40" };
const requiredStar = <span style={{ color: "#c0392b" }}>*</span>;

export default function NovaVenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const isAdmin = user?.role === "admin";
  const isDark = isAdmin && resolvedTheme === "dark";
  const { data: products = [], isLoading: loadingProducts } =
    trpc.products.list.useQuery();

  // Estado do seletor de DDI/país
  const [selectedCountry, setSelectedCountry] = useState<CountryPhone>(
    COUNTRIES[0]
  ); // Brasil
  const [ddiSearch, setDdiSearch] = useState("");
  const [showDdiDropdown, setShowDdiDropdown] = useState(false);
  const ddiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddiRef.current && !ddiRef.current.contains(e.target as Node)) {
        setShowDdiDropdown(false);
        setDdiSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!ddiSearch) return COUNTRIES;
    const q = ddiSearch.toLowerCase().replace(/^\+/, "");
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.ddi.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [ddiSearch]);

  // Estado do campo de data de nascimento como texto mascarado
  const [birthDateMasked, setBirthDateMasked] = useState("");
  const birthDateInputRef = useRef<HTMLInputElement>(null);
  const birthDateNativeRef = useRef<HTMLInputElement>(null);

  // Estado do combobox de produtos
  const [productQuery, setProductQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchSource, setClientSearchSource] =
    useState<ClientSearchSource>("name");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [debouncedClientSearchSource, setDebouncedClientSearchSource] =
    useState<ClientSearchSource>("name");
  const [activeClientIndex, setActiveClientIndex] = useState(-1);

  const [form, setForm] = useState({
    clientId: null as number | null,
    selectedClientSnapshot: null as ClientAutofillSnapshot | null,
    clientName: "",
    clientBirthDate: "",
    clientPhone: "",
    productName: "",
    productId: null as number | null,
    productCategory: "individual" as "individual" | "promocao" | "coletivo",
    saleDate: getLocalToday(),
    amountFormatted: "",
    notes: "",
  });
  const [consultationSlotId, setConsultationSlotId] = useState<number | null>(
    null
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedClientSearch(clientSearch.trim());
      setDebouncedClientSearchSource(clientSearchSource);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [clientSearch, clientSearchSource]);

  const clientSearchTerm = debouncedClientSearch.trim();
  const canSearchClients = canSearchClientTerm(
    debouncedClientSearchSource,
    clientSearchTerm
  );
  const [clientSuggestions, setClientSuggestions] = useState<
    RouterOutputs["clients"]["search"]
  >([]);
  const [clientSuggestionsTerm, setClientSuggestionsTerm] = useState("");
  const [loadingClientSuggestions, setLoadingClientSuggestions] =
    useState(false);
  const [clientSuggestionsSource, setClientSuggestionsSource] =
    useState<ClientSearchSource | null>(null);
  const [clientSearchError, setClientSearchError] = useState(false);
  const clientSearchRequestId = useRef(0);
  const { mutateAsync: searchClients } = trpc.clients.search.useMutation();

  useEffect(() => {
    const requestId = ++clientSearchRequestId.current;
    const currentClientSearchTerm = clientSearch.trim();
    const searchPairIsCurrent =
      debouncedClientSearchSource === clientSearchSource &&
      clientSearchTerm === currentClientSearchTerm;
    if (!canSearchClients || !clientDropdownOpen || !searchPairIsCurrent) {
      setClientSuggestions([]);
      setClientSuggestionsTerm("");
      setLoadingClientSuggestions(false);
      setClientSearchError(false);
      setActiveClientIndex(-1);
      setClientSuggestionsSource(null);
      return;
    }

    setLoadingClientSuggestions(true);
    setClientSearchError(false);
    setActiveClientIndex(-1);
    const requestSource = debouncedClientSearchSource;

    void searchClients({ query: clientSearchTerm })
      .then(results => {
        if (requestId !== clientSearchRequestId.current) return;
        setClientSuggestions(results);
        setClientSuggestionsTerm(clientSearchTerm);
        setClientSuggestionsSource(requestSource);
      })
      .catch(() => {
        if (requestId !== clientSearchRequestId.current) return;
        setClientSuggestionsSource(requestSource);
        setClientSuggestions([]);
        setClientSuggestionsTerm(clientSearchTerm);
        setClientSearchError(true);
      })
      .finally(() => {
        if (requestId !== clientSearchRequestId.current) return;
        setLoadingClientSuggestions(false);
      });
  }, [
    canSearchClients,
    clientSearch,
    clientSearchSource,
    clientDropdownOpen,
    clientSearchTerm,
    debouncedClientSearchSource,
    searchClients,
  ]);

  const beginClientSearch = (source: ClientSearchSource, term: string) => {
    setClientSearchSource(source);
    setClientSearch(term);
    setClientDropdownOpen(canSearchClientTerm(source, term));
    setActiveClientIndex(-1);
  };
  const isConsultaCartas = form.productName === CONSULTA_CARTAS;
  const canUploadClientPhotos =
    !isConsultaCartas &&
    (TYPES_WITH_PHOTOS as readonly string[]).includes(form.productCategory);

  // Busca slots disponíveis apenas quando Consulta Cartas estiver selecionado
  const { data: availableSlots = [], isLoading: loadingSlots } =
    trpc.consultationSlots.listAvailable.useQuery(undefined, {
      enabled: isConsultaCartas,
    });

  // Agrupa slots por data (consultationDate é string "YYYY-MM-DD")
  const slotsByDate = (availableSlots ?? []).reduce<
    Record<string, typeof availableSlots>
  >((acc, slot) => {
    const key = String(slot.consultationDate).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  // Normaliza texto removendo acentos para busca mais intuitiva
  const normalize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // Lista filtrada de produtos para o combobox
  const safeProducts = products ?? [];
  const filteredProducts = productQuery.trim()
    ? safeProducts.filter(p =>
        normalize(p.name).includes(normalize(productQuery))
      )
    : safeProducts;

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fotos do cliente (Individual)
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo1Preview, setPhoto1Preview] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [photo2Preview, setPhoto2Preview] = useState<string | null>(null);
  const photo1CameraRef = useRef<HTMLInputElement>(null);
  const photo1GalleryRef = useRef<HTMLInputElement>(null);
  const photo2CameraRef = useRef<HTMLInputElement>(null);
  const photo2GalleryRef = useRef<HTMLInputElement>(null);

  const createSale = trpc.sales.create.useMutation({
    onSuccess: () => {
      setSuccess(true);
      utils.sales.myHistory.invalidate();
    },
    onError: err => {
      toast.error(err.message || "Erro ao registrar venda. Tente novamente.");
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        selectedFile.type
      )
    ) {
      toast.error("Formato inválido. Use JPG, PNG, WEBP ou PDF.");
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  }, []);

  const handlePhotoChange = (selectedFile: File | null, slot: 1 | 2) => {
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Foto muito grande. Máximo 5MB.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)
    ) {
      toast.error("Use JPG, PNG ou WEBP para fotos.");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      if (slot === 1) {
        setPhoto1(selectedFile);
        setPhoto1Preview(result);
      } else {
        setPhoto2(selectedFile);
        setPhoto2Preview(result);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setForm(f => ({ ...f, amountFormatted: "" }));
      return;
    }
    const cents = parseInt(raw, 10);
    const formatted = (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    setForm(f => ({ ...f, amountFormatted: formatted }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value
      .replace(/\D/g, "")
      .slice(0, selectedCountry.maxDigits);
    const maskedPhone = applyPhoneMask(digits, selectedCountry.mask);
    setForm(current =>
      editAutofilledClientDetails(current, {
        clientPhone: maskedPhone,
      })
    );
    beginClientSearch("phone", digits);
  };

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData("text");
    if (!raw.trim().startsWith("+")) return; // sem DDI → onChange trata normalmente
    e.preventDefault();
    const allDigits = raw.replace(/\D/g, "");
    // Detecta o país pelo DDI (testa do mais longo para o mais curto para evitar ambiguidade)
    const sorted = [...COUNTRIES].sort((a, b) => b.ddi.length - a.ddi.length);
    const detected = sorted.find(c => allDigits.startsWith(c.ddi));
    const country = detected ?? selectedCountry;
    if (detected) setSelectedCountry(detected);
    const local = allDigits
      .slice(country.ddi.length)
      .slice(0, country.maxDigits);
    const maskedPhone = applyPhoneMask(local, country.mask);
    setForm(current =>
      editAutofilledClientDetails(current, {
        clientPhone: maskedPhone,
      })
    );
    beginClientSearch("phone", local);
  };

  const selectClientSuggestion = (
    client: (typeof clientSuggestions)[number]
  ) => {
    const birthDate = client.birthDate
      ? String(client.birthDate).slice(0, 10)
      : "";
    const { country, localDigits } = parsePhoneForInput(
      client.phone ?? "",
      COUNTRIES[0]
    );

    setSelectedCountry(country);
    setBirthDateMasked(fmtDate(birthDate));
    setForm(current =>
      applyClientAutofill(current, {
        id: client.id,
        fullName: client.fullName,
        birthDate,
        phone: applyPhoneMask(localDigits, country.mask),
        snapshot: {
          birthDateWasEmpty:
            client.birthDate == null || String(client.birthDate).trim() === "",
          phoneWasEmpty: client.phone == null || client.phone.trim() === "",
        },
      })
    );
    setClientSearch(client.fullName);
    setClientDropdownOpen(false);
    setActiveClientIndex(-1);
  };

  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setClientDropdownOpen(false);
      setActiveClientIndex(-1);
      return;
    }

    if (
      !clientDropdownOpen ||
      clientSearch.trim() !== clientSearchTerm ||
      clientSuggestionsTerm !== clientSearchTerm ||
      clientSuggestions.length === 0
    ) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveClientIndex(current =>
        current >= clientSuggestions.length - 1 ? 0 : current + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveClientIndex(current =>
        current <= 0 ? clientSuggestions.length - 1 : current - 1
      );
    } else if (e.key === "Enter" && activeClientIndex >= 0) {
      e.preventDefault();
      selectClientSuggestion(clientSuggestions[activeClientIndex]);
    }
  };

  // Handler da máscara de data de nascimento
  const handleBirthDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyDateMask(e.target.value);
    setBirthDateMasked(masked);
    const iso = parseDateMask(masked);
    setForm(current =>
      editAutofilledClientDetails(current, { clientBirthDate: iso })
    );
  };

  // Quando o input nativo (calendário) muda, sincroniza a máscara
  const handleBirthDateNative = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // "YYYY-MM-DD"
    setForm(current =>
      editAutofilledClientDetails(current, { clientBirthDate: iso })
    );
    if (iso) {
      const [y, mo, d] = iso.split("-");
      setBirthDateMasked(`${d}/${mo}/${y}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) {
      toast.error("Nome do cliente é obrigatório.");
      return;
    }
    if (!form.clientBirthDate) {
      toast.error("Data de nascimento é obrigatória.");
      return;
    }
    {
      const birth = new Date(form.clientBirthDate + "T12:00:00");
      const today = new Date();
      const age =
        today.getFullYear() -
        birth.getFullYear() -
        (today <
        new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
          ? 1
          : 0);
      if (age < 18) {
        toast.error("O cliente deve ter pelo menos 18 anos.");
        return;
      }
    }
    if (!form.clientPhone.replace(/\D/g, "")) {
      toast.error("Telefone é obrigatório.");
      return;
    }
    if (!form.productName) {
      toast.error("Selecione o trabalho espiritual.");
      return;
    }
    if (!form.amountFormatted) {
      toast.error("Informe o valor do trabalho.");
      return;
    }
    if (!form.notes.trim()) {
      toast.error("Observações são obrigatórias.");
      return;
    }
    if (!file) {
      toast.error("Comprovante é obrigatório.");
      return;
    }

    let attachmentBase64: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentName: string | undefined;

    if (file) {
      attachmentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      attachmentMime = file.type;
      attachmentName = file.name;
    }

    if (isConsultaCartas && !consultationSlotId) {
      toast.error("Selecione o horário da consulta.");
      return;
    }

    // Converte fotos para base64 se existirem
    const toBase64 = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler foto"));
        reader.readAsDataURL(f);
      });

    let photo1Base64: string | undefined;
    let photo1Mime: string | undefined;
    let photo2Base64: string | undefined;
    let photo2Mime: string | undefined;

    if (canUploadClientPhotos) {
      if (photo1) {
        photo1Base64 = await toBase64(photo1);
        photo1Mime = photo1.type;
      }
      if (photo2) {
        photo2Base64 = await toBase64(photo2);
        photo2Mime = photo2.type;
      }
    }

    await createSale.mutateAsync({
      clientId: form.clientId ?? undefined,
      clientName: form.clientName.trim(),
      clientBirthDate: form.clientBirthDate || undefined,
      clientPhone: form.clientPhone
        ? selectedCountry.ddi === "55"
          ? form.clientPhone.replace(/\D/g, "")
          : `+${selectedCountry.ddi}${form.clientPhone.replace(/\D/g, "")}`
        : undefined,
      productName: form.productName,
      productId: form.productId ?? undefined,
      productCategory: form.productCategory,
      saleDate: form.saleDate,
      amount: parseCurrencyToNumber(form.amountFormatted),
      notes: form.notes || undefined,
      consultationSlotId: consultationSlotId ?? undefined,
      attachmentBase64,
      attachmentMime,
      attachmentName,
      photo1Base64,
      photo1Mime,
      photo2Base64,
      photo2Mime,
    });
  };

  useEffect(() => {
    if (canUploadClientPhotos) return;
    setPhoto1(null);
    setPhoto1Preview(null);
    setPhoto2(null);
    setPhoto2Preview(null);
  }, [canUploadClientPhotos]);

  const resetForm = () => {
    setForm({
      clientId: null,
      selectedClientSnapshot: null,
      clientName: "",
      clientBirthDate: "",
      clientPhone: "",
      productName: "",
      productId: null,
      productCategory: "individual",
      saleDate: getLocalToday(),
      amountFormatted: "",
      notes: "",
    });
    setBirthDateMasked("");
    setSelectedCountry(COUNTRIES[0]);
    setClientSearch("");
    setDebouncedClientSearch("");
    setClientSearchSource("name");
    setClientDropdownOpen(false);
    setDebouncedClientSearchSource("name");
    setClientSuggestions([]);
    setClientSuggestionsTerm("");
    setClientSuggestionsSource(null);
    setActiveClientIndex(-1);
    clientInputRef.current?.blur();
    setProductQuery("");
    setProductDropdownOpen(false);
    setFile(null);
    setFilePreview(null);
    setPhoto1(null);
    setPhoto1Preview(null);
    setPhoto2(null);
    setPhoto2Preview(null);
    setConsultationSlotId(null);
    setSuccess(false);
  };

  // ── Tela de sucesso ────────────────────────────────────────────
  if (success) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center max-w-sm mx-auto px-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #1a7a4a, #22924f)",
              }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2
              className="text-3xl font-bold mb-3"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: isDark ? "var(--foreground)" : "#1a1a2e",
              }}
            >
              Venda Registrada!
            </h2>
            <p
              className="text-base mb-2"
              style={{ color: isDark ? "var(--muted-foreground)" : "#737390" }}
            >
              A venda foi salva com sucesso no sistema.
            </p>
            <p
              className="text-sm mb-8"
              style={{ color: isDark ? "var(--muted-foreground)" : "#8888a0" }}
            >
              O administrador poderá visualizá-la no painel.
            </p>
            <button
              onClick={resetForm}
              className="w-full py-5 px-8 rounded-2xl text-white font-semibold text-lg transition-all active:scale-[0.98] shadow-lg"
              style={{
                background: "linear-gradient(135deg, #c17f24, #d4932a)",
              }}
            >
              Registrar Nova Venda
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Classe base dos inputs ─────────────────────────────────────
  const inputClass = `w-full px-4 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${isMobile ? "py-4 text-[16px]" : "py-3"}`;
  const cardClass = "rounded-2xl p-5 shadow-sm";
  const cardStyle = isDark
    ? {
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }
    : { background: "white", border: "1px solid #ddd5c4" };
  const dynInputStyle = isDark
    ? {
        border: "1.5px solid var(--border)",
        background: "var(--secondary)",
        color: "var(--foreground)",
      }
    : inputStyle;
  const dynLabelStyle = isDark ? { color: "var(--foreground)" } : labelStyle;
  const dynHeadingColor = isDark ? "var(--foreground)" : "#1a1a2e";
  const dynSubColor = isDark ? "var(--muted-foreground)" : "#737390";
  const renderClientSuggestions = (source: ClientSearchSource) => {
    const suggestionsAreCurrent =
      clientSearchSource === source &&
      debouncedClientSearchSource === source &&
      clientSuggestionsSource === source &&
      clientSearch.trim() === clientSearchTerm &&
      clientSuggestionsTerm === clientSearchTerm;
    const optionId = (index: number) => `client-${source}-suggestion-${index}`;

    return (
      <div
        id={`client-suggestions-${source}`}
        role="listbox"
        className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
        style={{
          background: isDark ? "var(--card)" : "white",
          border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4",
          maxHeight: 260,
          overflowY: "auto",
        }}
      >
        {!suggestionsAreCurrent || loadingClientSuggestions ? (
          <div
            className="px-4 py-3 text-sm flex items-center gap-2"
            style={{ color: dynSubColor }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Buscando clientes...
          </div>
        ) : clientSearchError ? (
          <div className="px-4 py-3 text-sm" style={{ color: dynSubColor }}>
            {"N\u00e3o foi poss\u00edvel buscar clientes agora."}
          </div>
        ) : clientSuggestions.length === 0 ? (
          <div className="px-4 py-3 text-sm" style={{ color: dynSubColor }}>
            Nenhum cliente encontrado. Continue preenchendo para cadastrar um
            novo.
          </div>
        ) : (
          clientSuggestions.map((client, index) => (
            <button
              id={optionId(index)}
              key={client.id}
              type="button"
              role="option"
              aria-selected={activeClientIndex === index}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveClientIndex(index)}
              onClick={() => selectClientSuggestion(client)}
              className="w-full px-4 py-3 text-left transition-colors"
              style={{
                background:
                  activeClientIndex === index
                    ? isDark
                      ? "var(--accent)"
                      : "#ede8de"
                    : isDark
                      ? "var(--card)"
                      : "white",
                color: isDark ? "var(--foreground)" : "#1a1a2e",
                borderBottom: isDark
                  ? "1px solid var(--border)"
                  : "1px solid #eee8dc",
              }}
            >
              <span className="block text-sm font-semibold">
                {client.fullName}
              </span>
              <span
                className="block text-xs mt-0.5"
                style={{ color: dynSubColor }}
              >
                {client.phone || "Telefone n\u00e3o informado"}
                {client.birthDate
                  ? ` - ${fmtDate(String(client.birthDate))}`
                  : ""}
              </span>
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}
          >
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: dynHeadingColor,
              }}
            >
              Nova Venda
            </h1>
            <p className="text-sm" style={{ color: dynSubColor }}>
              Olá, <strong>{user?.name?.split(" ")[0] || "Vendedor"}</strong>!
              Preencha os dados abaixo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Card 1: Dados do Cliente ── */}
          <div className={cardClass} style={cardStyle}>
            <h2
              className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: dynHeadingColor }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}
              >
                1
              </span>
              Dados do Cliente
            </h2>
            <div className="space-y-4">
              {/* Nome */}
              <div className="relative">
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Nome Completo {requiredStar}
                </label>
                <input
                  ref={clientInputRef}
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="client-suggestions-name"
                  aria-expanded={
                    clientDropdownOpen && clientSearchSource === "name"
                  }
                  aria-activedescendant={
                    clientSearchSource === "name" && activeClientIndex >= 0
                      ? `client-name-suggestion-${activeClientIndex}`
                      : undefined
                  }
                  value={form.clientName}
                  onChange={e => {
                    const value = e.target.value;
                    const selectedClientNameWasEdited =
                      form.clientId !== null && value !== form.clientName;
                    setForm(current =>
                      editAutofilledClientName(current, value)
                    );
                    if (selectedClientNameWasEdited) {
                      setBirthDateMasked("");
                      setSelectedCountry(COUNTRIES[0]);
                    }
                    beginClientSearch("name", value);
                  }}
                  onFocus={() => {
                    beginClientSearch("name", form.clientName);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setClientDropdownOpen(false);
                      setActiveClientIndex(-1);
                    }, 150);
                  }}
                  onKeyDown={handleClientKeyDown}
                  placeholder="Ex: Maria da Silva"
                  className={inputClass}
                  style={dynInputStyle}
                  autoComplete="off"
                  maxLength={256}
                  required
                />

                {clientDropdownOpen &&
                  clientSearchSource === "name" &&
                  canSearchClientTerm("name", clientSearch) &&
                  renderClientSuggestions("name")}
              </div>

              {/* Data de Nascimento — input text com máscara dd/mm/aaaa + botão calendário */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Data de Nascimento {requiredStar}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={birthDateInputRef}
                    type="text"
                    inputMode="numeric"
                    value={birthDateMasked}
                    onChange={handleBirthDateInput}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className={inputClass}
                    style={dynInputStyle}
                    autoComplete="off"
                  />
                  {/* Botão calendário — abre o input nativo oculto */}
                  <button
                    type="button"
                    onClick={() => birthDateNativeRef.current?.showPicker?.()}
                    className="shrink-0 flex items-center justify-center rounded-xl transition-all active:scale-95"
                    style={{
                      width: isMobile ? 52 : 44,
                      height: isMobile ? 52 : 44,
                      background: isDark ? "var(--secondary)" : "#faf8f4",
                      border: isDark
                        ? "1.5px solid var(--border)"
                        : "1.5px solid #ddd5c4",
                      color: "#c17f24",
                    }}
                    aria-label="Abrir calendário"
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                  {/* Input nativo oculto — usado apenas pelo botão calendário */}
                  <input
                    ref={birthDateNativeRef}
                    type="date"
                    value={form.clientBirthDate}
                    onChange={handleBirthDateNative}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="relative">
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Telefone {requiredStar}
                </label>
                <div className="flex gap-2">
                  {/* Seletor de DDI */}
                  <div ref={ddiRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDdiDropdown(d => !d);
                        setDdiSearch("");
                      }}
                      className={`flex items-center gap-1 px-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${isMobile ? "py-4" : "py-3"}`}
                      style={{ ...dynInputStyle, width: "auto" }}
                    >
                      <span className="text-base leading-none">
                        {selectedCountry.flag}
                      </span>
                      <span className="text-xs font-mono font-semibold">
                        +{selectedCountry.ddi}
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>

                    {showDdiDropdown && (
                      <div
                        className="absolute z-30 left-0 top-full mt-1 w-64 rounded-xl shadow-xl border border-[var(--border)] overflow-hidden"
                        style={{ background: "var(--card)" }}
                      >
                        <div className="p-2 border-b border-[var(--border)]">
                          <input
                            type="text"
                            value={ddiSearch}
                            onChange={e => setDdiSearch(e.target.value)}
                            placeholder="País ou código (+55, Brazil...)"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] outline-none focus:ring-2 focus:ring-amber-400/40"
                            style={dynInputStyle}
                            autoFocus
                          />
                        </div>
                        <ul className="max-h-52 overflow-y-auto">
                          {filteredCountries.length === 0 && (
                            <li
                              className="px-4 py-3 text-sm text-center"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              Nenhum país encontrado
                            </li>
                          )}
                          {filteredCountries.map(country => (
                            <li
                              key={country.code}
                              onMouseDown={() => {
                                setSelectedCountry(country);
                                setShowDdiDropdown(false);
                                setDdiSearch("");
                                setForm(current =>
                                  editAutofilledClientDetails(current, {
                                    clientPhone: "",
                                  })
                                );
                                beginClientSearch("phone", "");
                              }}
                              className="px-3 py-2 text-sm cursor-pointer flex items-center gap-2 hover:bg-[var(--secondary)] transition-colors"
                              style={{
                                color: "var(--foreground)",
                                background:
                                  selectedCountry.code === country.code
                                    ? "var(--secondary)"
                                    : undefined,
                              }}
                            >
                              <span className="text-base w-6 text-center">
                                {country.flag}
                              </span>
                              <span className="flex-1 truncate">
                                {country.name}
                              </span>
                              <span
                                className="text-xs font-mono shrink-0"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                +{country.ddi}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Input do número local */}
                  <input
                    type="tel"
                    inputMode="tel"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls="client-suggestions-phone"
                    aria-expanded={
                      clientDropdownOpen && clientSearchSource === "phone"
                    }
                    aria-activedescendant={
                      clientSearchSource === "phone" && activeClientIndex >= 0
                        ? `client-phone-suggestion-${activeClientIndex}`
                        : undefined
                    }
                    value={form.clientPhone}
                    onChange={handlePhoneChange}
                    onPaste={handlePhonePaste}
                    onFocus={() =>
                      beginClientSearch(
                        "phone",
                        form.clientPhone.replace(/\D/g, "")
                      )
                    }
                    onBlur={() => {
                      window.setTimeout(() => {
                        setClientDropdownOpen(false);
                        setActiveClientIndex(-1);
                      }, 150);
                    }}
                    onKeyDown={handleClientKeyDown}
                    placeholder={selectedCountry.mask.replace(/#/g, "0")}
                    maxLength={selectedCountry.mask.length}
                    className={`flex-1 ${inputClass}`}
                    style={dynInputStyle}
                    required
                  />
                </div>
                {clientDropdownOpen &&
                  clientSearchSource === "phone" &&
                  canSearchClientTerm("phone", clientSearch) &&
                  renderClientSuggestions("phone")}
              </div>
            </div>
          </div>

          {/* ── Card 2: Dados do Trabalho ── */}
          <div className={cardClass} style={cardStyle}>
            <h2
              className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: dynHeadingColor }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}
              >
                2
              </span>
              Dados do Trabalho
            </h2>
            <div className="space-y-4">
              {/* Trabalho Espiritual — input único com autocomplete */}
              <div className="relative">
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Trabalho Espiritual {requiredStar}
                </label>
                <div className="relative">
                  <input
                    ref={productInputRef}
                    type="text"
                    value={
                      productDropdownOpen ? productQuery : form.productName
                    }
                    onChange={e => {
                      setProductQuery(e.target.value);
                      setProductDropdownOpen(true);
                      // Se o utilizador apagar tudo, limpa a seleção
                      if (!e.target.value) {
                        setForm(f => ({
                          ...f,
                          productName: "",
                          productId: null,
                        }));
                      }
                    }}
                    onFocus={() => {
                      setProductQuery("");
                      setProductDropdownOpen(true);
                    }}
                    onBlur={() => {
                      // Pequeno delay para permitir o click no item da lista
                      setTimeout(() => setProductDropdownOpen(false), 150);
                    }}
                    placeholder={
                      loadingProducts
                        ? "Carregando..."
                        : "Digite ou selecione o trabalho..."
                    }
                    readOnly={loadingProducts}
                    className={inputClass}
                    style={{
                      ...dynInputStyle,
                      paddingRight: "2.5rem",
                    }}
                    autoComplete="off"
                  />
                  {/* Botão de seta para abrir dropdown ao clicar */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      if (productDropdownOpen) {
                        setProductDropdownOpen(false);
                      } else {
                        setProductQuery("");
                        setProductDropdownOpen(true);
                        productInputRef.current?.focus();
                      }
                    }}
                    className="absolute right-3 top-1/2 p-1 rounded transition-transform"
                    style={{
                      color: isDark ? "var(--muted-foreground)" : "#737390",
                      transform: productDropdownOpen
                        ? "translateY(-50%) rotate(180deg)"
                        : "translateY(-50%)",
                    }}
                    aria-label="Abrir lista de trabalhos"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Dropdown de sugestões */}
                {productDropdownOpen && !loadingProducts && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
                    style={{
                      background: isDark ? "var(--card)" : "white",
                      border: isDark
                        ? "1.5px solid var(--border)"
                        : "1.5px solid #ddd5c4",
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div
                        className="px-4 py-3 text-sm"
                        style={{ color: dynSubColor }}
                      >
                        Nenhum trabalho encontrado.
                      </div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()} // evita blur antes do click
                          onClick={() => {
                            const allowed = (p as any).allowedCategories ?? [
                              "individual",
                              "promocao",
                              "coletivo",
                            ];
                            setForm(f => {
                              const newCategory = allowed.includes(
                                f.productCategory
                              )
                                ? f.productCategory
                                : allowed[0];
                              return {
                                ...f,
                                productName: p.name,
                                productId: p.id,
                                productCategory: newCategory,
                              };
                            });
                            setProductQuery("");
                            setProductDropdownOpen(false);
                            productInputRef.current?.blur();
                          }}
                          className="w-full text-left transition-colors"
                          style={{
                            padding: isMobile ? "14px 16px" : "10px 16px",
                            fontSize: isMobile ? 16 : 14,
                            background:
                              form.productName === p.name
                                ? isDark
                                  ? "var(--accent)"
                                  : "#ede8de"
                                : isDark
                                  ? "var(--card)"
                                  : "white",
                            color: isDark ? "var(--foreground)" : "#1a1a2e",
                            borderBottom: isDark
                              ? "1px solid var(--border)"
                              : "1px solid #ddd5c4",
                          }}
                        >
                          {productQuery.trim()
                            ? (() => {
                                const normName = normalize(p.name);
                                const normQuery = normalize(productQuery);
                                const idx = normName.indexOf(normQuery);
                                if (idx === -1) return p.name;
                                const before = p.name.slice(0, idx);
                                const match = p.name.slice(
                                  idx,
                                  idx + productQuery.length
                                );
                                const after = p.name.slice(
                                  idx + productQuery.length
                                );
                                return (
                                  <>
                                    {before}
                                    <strong style={{ color: "var(--primary)" }}>
                                      {match}
                                    </strong>
                                    {after}
                                  </>
                                );
                              })()
                            : p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tipo (categoria da venda) — oculto para Consulta Cartas */}
              {!isConsultaCartas &&
                (() => {
                  const selectedProduct = safeProducts.find(
                    p => p.id === form.productId
                  );
                  const allowed: string[] = (selectedProduct as any)
                    ?.allowedCategories ?? [
                    "individual",
                    "promocao",
                    "coletivo",
                  ];
                  const allOptions = [
                    { value: "individual", label: "Individual", icon: "" },
                    { value: "promocao", label: "Promoção", icon: "⭐ " },
                    { value: "coletivo", label: "Coletivo", icon: "👥 " },
                  ] as const;
                  const visibleOptions = allOptions.filter(opt =>
                    allowed.includes(opt.value)
                  );
                  return (
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        style={dynLabelStyle}
                      >
                        Tipo {requiredStar}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {visibleOptions.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setForm(f => ({
                                ...f,
                                productCategory: opt.value,
                              }))
                            }
                            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                            style={
                              form.productCategory === opt.value
                                ? {
                                    background:
                                      opt.value === "promocao"
                                        ? "#ede8de"
                                        : opt.value === "coletivo"
                                          ? "#e0e0f8"
                                          : "#ddd5c4",
                                    color:
                                      opt.value === "promocao"
                                        ? "#7a5518"
                                        : opt.value === "coletivo"
                                          ? "#4040b0"
                                          : "#2a2a40",
                                    borderColor:
                                      opt.value === "promocao"
                                        ? "#c4a030"
                                        : opt.value === "coletivo"
                                          ? "#4a70c0"
                                          : "#737390",
                                  }
                                : {
                                    background: isDark
                                      ? "var(--secondary)"
                                      : "white",
                                    color: isDark
                                      ? "var(--muted-foreground)"
                                      : "#737390",
                                    borderColor: isDark
                                      ? "var(--border)"
                                      : "#ddd5c4",
                                  }
                            }
                          >
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              {/* Data da Venda */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Data da Venda {user?.role === "admin" ? requiredStar : null}
                </label>
                {user?.role === "admin" ? (
                  <input
                    type="date"
                    value={form.saleDate}
                    onChange={e =>
                      setForm(f => ({ ...f, saleDate: e.target.value }))
                    }
                    className={inputClass}
                    style={dynInputStyle}
                    required
                  />
                ) : (
                  <div
                    className={inputClass}
                    style={{
                      ...dynInputStyle,
                      background: isDark ? "var(--muted)" : "#f5f0e8",
                      color: isDark ? "var(--muted-foreground)" : "#4a4a60",
                      cursor: "not-allowed",
                    }}
                  >
                    {fmtDate(form.saleDate)}
                  </div>
                )}
              </div>

              {/* Horário da Consulta — exibido apenas para Consulta Cartas */}
              {isConsultaCartas && (
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={dynLabelStyle}
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar
                        className="w-4 h-4"
                        style={{ color: "#5050c0" }}
                      />
                      Horário da Consulta {requiredStar}
                    </span>
                  </label>
                  {loadingSlots ? (
                    <div
                      className="flex items-center gap-2 py-3"
                      style={{ color: dynSubColor }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando horários...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div
                      className="rounded-xl p-4 text-center"
                      style={{
                        background: isDark ? "var(--secondary)" : "#f5f0e8",
                        border: isDark
                          ? "1.5px solid var(--border)"
                          : "1.5px solid #ddd5c4",
                      }}
                    >
                      <Clock
                        className="w-6 h-6 mx-auto mb-2"
                        style={{ color: dynSubColor }}
                      />
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: isDark ? "var(--foreground)" : "#3a3a50",
                        }}
                      >
                        Nenhum horário disponível
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: dynSubColor }}
                      >
                        Aguarde o administrador ou a consultora adicionar novos
                        horários.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(slotsByDate).map(([dateKey, slots]) => (
                        <div key={dateKey}>
                          <p
                            className="text-xs font-semibold mb-2 flex items-center gap-1"
                            style={{ color: "#5050c0" }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {fmtDate(dateKey)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(slots ?? []).map(slot => (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() =>
                                  setConsultationSlotId(
                                    consultationSlotId === slot.id
                                      ? null
                                      : slot.id
                                  )
                                }
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                                  consultationSlotId === slot.id
                                    ? "text-white border-transparent"
                                    : "border-transparent"
                                }`}
                                style={
                                  consultationSlotId === slot.id
                                    ? { background: "#5050c0", color: "white" }
                                    : {
                                        background: "#eaeaf8",
                                        color: "#3a3a9a",
                                        border: "1.5px solid #c0c0e8",
                                      }
                                }
                              >
                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                {slot.consultationTime}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Valor */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Valor do Trabalho {requiredStar}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amountFormatted}
                  onChange={handleAmountChange}
                  placeholder="R$ 0,00"
                  className={`${inputClass} font-semibold text-lg`}
                  style={dynInputStyle}
                  required
                />
              </div>

              {/* Observações */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={dynLabelStyle}
                >
                  Observações {requiredStar}
                </label>
                <textarea
                  value={form.notes}
                  onChange={e =>
                    setForm(f => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Alguma observação sobre a venda..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                  style={dynInputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── Card 3: Comprovante ── */}
          <div className={cardClass} style={cardStyle}>
            <h2
              className="text-sm font-semibold mb-4 flex items-center gap-2"
              style={{ color: dynHeadingColor }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}
              >
                3
              </span>
              Comprovante {requiredStar}
            </h2>

            {file ? (
              /* Arquivo selecionado */
              <div
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{
                  background: isDark ? "var(--secondary)" : "#f5f0e8",
                  border: isDark
                    ? "1.5px solid var(--border)"
                    : "1.5px solid #ddd5c4",
                }}
              >
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg shadow-sm shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "#ddd5c4" }}
                  >
                    <FileText
                      className="w-8 h-8"
                      style={{ color: "#c17f24" }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: isDark ? "var(--foreground)" : "#1a1a2e" }}
                  >
                    {file.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: dynSubColor }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setFilePreview(null);
                  }}
                  className="p-2 rounded-lg"
                  style={{ color: "#c0392b" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : isMobile ? (
              /* Upload mobile: dois botões grandes (câmera + galeria) */
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl transition-all active:scale-[0.97]"
                  style={{
                    background: isDark ? "var(--secondary)" : "#ede8de",
                    border: isDark
                      ? "1.5px solid var(--border)"
                      : "1.5px solid #ddd5c4",
                  }}
                >
                  <Camera className="w-7 h-7" style={{ color: "#c17f24" }} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: isDark ? "var(--foreground)" : "#2a2a40" }}
                  >
                    Tirar Foto
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl transition-all active:scale-[0.97]"
                  style={{
                    background: isDark ? "var(--secondary)" : "#ede8de",
                    border: isDark
                      ? "1.5px solid var(--border)"
                      : "1.5px solid #ddd5c4",
                  }}
                >
                  <Upload className="w-7 h-7" style={{ color: "#c17f24" }} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: isDark ? "var(--foreground)" : "#2a2a40" }}
                  >
                    Galeria / PDF
                  </span>
                </button>
              </div>
            ) : (
              /* Upload desktop: drag & drop */
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{
                  borderColor: isDragging
                    ? "#c17f24"
                    : isDark
                      ? "var(--border)"
                      : "#ddd5c4",
                  background: isDragging
                    ? isDark
                      ? "var(--accent)"
                      : "#ede8de"
                    : isDark
                      ? "var(--secondary)"
                      : "#faf8f4",
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "#ede8de" }}
                  >
                    <Upload className="w-6 h-6" style={{ color: "#c17f24" }} />
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: isDark ? "var(--foreground)" : "#2a2a40",
                      }}
                    >
                      Clique ou arraste o comprovante aqui
                    </p>
                    <p className="text-xs mt-1" style={{ color: dynSubColor }}>
                      JPG, PNG, WEBP ou PDF — máx. 5MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Input câmera (mobile, capture=camera) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {/* Input galeria/arquivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* ── Card 4: Fotos do Cliente (apenas Individual) ── */}
          {canUploadClientPhotos && (
            <div className={cardClass} style={cardStyle}>
              <h2
                className="text-sm font-semibold mb-4 flex items-center gap-2"
                style={{ color: dynHeadingColor }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "#c17f24" }}
                >
                  4
                </span>
                Fotos do Cliente{" "}
                <span
                  className="text-xs font-normal ml-1"
                  style={{ color: dynSubColor }}
                >
                  (opcional)
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {([1, 2] as const).map(slot => {
                  const preview = slot === 1 ? photo1Preview : photo2Preview;
                  const photoFile = slot === 1 ? photo1 : photo2;
                  const cameraRef =
                    slot === 1 ? photo1CameraRef : photo2CameraRef;
                  const galleryRef =
                    slot === 1 ? photo1GalleryRef : photo2GalleryRef;
                  const clearPhoto = () => {
                    if (slot === 1) {
                      setPhoto1(null);
                      setPhoto1Preview(null);
                    } else {
                      setPhoto2(null);
                      setPhoto2Preview(null);
                    }
                  };
                  return (
                    <div key={slot}>
                      <p
                        className="text-xs font-medium mb-2"
                        style={{ color: dynSubColor }}
                      >
                        Foto {slot}
                      </p>
                      {preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt={`Foto ${slot}`}
                            className="w-full aspect-[3/4] object-cover rounded-xl shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={clearPhoto}
                            className="absolute top-2 right-2 p-1.5 rounded-full shadow"
                            style={{ background: "rgba(0,0,0,0.55)" }}
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => cameraRef.current?.click()}
                            className="flex flex-col items-center gap-1.5 py-4 rounded-xl transition-all active:scale-[0.97]"
                            style={{
                              background: isDark
                                ? "var(--secondary)"
                                : "#ede8de",
                              border: isDark
                                ? "1.5px solid var(--border)"
                                : "1.5px solid #ddd5c4",
                            }}
                          >
                            <Camera
                              className="w-6 h-6"
                              style={{ color: "#c17f24" }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{
                                color: isDark ? "var(--foreground)" : "#2a2a40",
                              }}
                            >
                              Câmera
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => galleryRef.current?.click()}
                            className="flex flex-col items-center gap-1.5 py-4 rounded-xl transition-all active:scale-[0.97]"
                            style={{
                              background: isDark
                                ? "var(--secondary)"
                                : "#ede8de",
                              border: isDark
                                ? "1.5px solid var(--border)"
                                : "1.5px solid #ddd5c4",
                            }}
                          >
                            <ImagePlus
                              className="w-6 h-6"
                              style={{ color: "#c17f24" }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{
                                color: isDark ? "var(--foreground)" : "#2a2a40",
                              }}
                            >
                              Galeria
                            </span>
                          </button>
                        </div>
                      )}
                      <input
                        ref={cameraRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden"
                        onChange={e =>
                          handlePhotoChange(e.target.files?.[0] ?? null, slot)
                        }
                      />
                      <input
                        ref={galleryRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e =>
                          handlePhotoChange(e.target.files?.[0] ?? null, slot)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Botão Registrar ── */}
          <button
            type="submit"
            disabled={createSale.isPending}
            className={`w-full rounded-2xl text-white font-semibold transition-all active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${isMobile ? "py-5 text-lg" : "py-4 text-base"}`}
            style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}
          >
            {createSale.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando venda...
              </span>
            ) : (
              "✓  Registrar Venda"
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
