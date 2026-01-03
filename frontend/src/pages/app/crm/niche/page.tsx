import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { MouseEvent, useCallback, useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

import {
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  capitalize,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FilledInput,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  PopoverVirtualElement,
  Select,
  SelectProps,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Grid } from "@mui/material";
import { getGridDateOperators, GridColDef } from "@mui/x-data-grid";
import {
  ColumnsPanelTrigger,
  DataGrid,
  ExportCsv,
  ExportPrint,
  FilterPanelTrigger,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridRowSpacingParams,
  QuickFilter,
  QuickFilterClear,
  QuickFilterControl,
  Toolbar,
  useGridApiRef,
} from "@mui/x-data-grid";

import DataGridDateTimeFilter from "@/components/data-grid/data-grid-date-time-filter";
import { DataGridPaginationFullPage } from "@/components/data-grid/data-grid-pagination";
import NiArrowDown from "@/icons/nexture/ni-arrow-down";
import NiArrowInDown from "@/icons/nexture/ni-arrow-in-down";
import NiArrowUp from "@/icons/nexture/ni-arrow-up";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronLeftRightSmall from "@/icons/nexture/ni-chevron-left-right-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiClock from "@/icons/nexture/ni-clock";
import NiCols from "@/icons/nexture/ni-cols";
import NiCross from "@/icons/nexture/ni-cross";
import NiCrossSquare from "@/icons/nexture/ni-cross-square";
import NiDocumentFull from "@/icons/nexture/ni-document-full";
import NiDuplicate from "@/icons/nexture/ni-duplicate";
import NiEllipsisVertical from "@/icons/nexture/ni-ellipsis-vertical";
import NiExclamationSquare from "@/icons/nexture/ni-exclamation-square";
import NiEyeInactive from "@/icons/nexture/ni-eye-inactive";
import NiFilter from "@/icons/nexture/ni-filter";
import NiFilterPlus from "@/icons/nexture/ni-filter-plus";
import NiMinusSquare from "@/icons/nexture/ni-minus-square";
import NiArrowHistory from "@/icons/nexture/ni-arrow-history";
import NiEmail from "@/icons/nexture/ni-email";
import NiPenSquare from "@/icons/nexture/ni-pen-square";
import NiPrinter from "@/icons/nexture/ni-printer";
import NiSearch from "@/icons/nexture/ni-search";
import NiList from "@/icons/nexture/ni-list";
import NiSigns from "@/icons/nexture/ni-signs";
import { cn } from "@/lib/utils";

interface Niche {
  id: number;
  name: string;
  description: string | null;
  locations: string[];
  contact_count: number;
}

interface Review {
  author: string | null;
  rating: number | null;
  text: string | null;
  date: string | null;
  response: string | null;
  likes: number | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  // Additional business details
  description: string | null;
  opening_hours: { schedule?: string[] } | null;
  services: string[] | null;
  products: string[] | null;
  price_range: string | null;
  google_maps_url: string | null;
  place_id: string | null;
  reviews: Review[] | null;
}

type Row = {
  id: string | number;
  name: string;
  avatar?: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  lastContact: Date | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  // Additional business details
  description: string | null;
  openingHours: { schedule?: string[] } | null;
  services: string[] | null;
  products: string[] | null;
  priceRange: string | null;
  googleMapsUrl: string | null;
  placeId: string | null;
  category: string | null;
  reviewsCount: number | null;
  reviews: Review[] | null;
};

type ViewMode = "table" | "map";

dayjs.extend(duration);
dayjs.extend(relativeTime);

// Custom CSS for crosshair cursor on map (for click-to-scrape)
const mapCursorStyle = `
  .leaflet-container.map-scrape-mode {
    cursor: crosshair !important;
  }
  .leaflet-container.map-scrape-mode .leaflet-marker-icon,
  .leaflet-container.map-scrape-mode .leaflet-marker-shadow {
    cursor: pointer !important;
  }
`;

// Reverse geocode function using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`,
      { headers: { "User-Agent": "BusinessDashboard/1.0" } }
    );
    if (!response.ok) throw new Error("Geocode failed");
    const data = await response.json();
    // Extract city/town/village and country
    const addr = data.address;
    const locality = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
    const country = addr.country || "";
    return locality ? `${locality}, ${country}` : data.display_name?.split(",").slice(0, 3).join(",") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Map click handler component
function MapClickHandler({ onLocationClick }: { nicheName: string; onLocationClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function NicheDetailPage() {
  const { nicheId } = useParams<{ nicheId: string }>();
  const navigate = useNavigate();
  
  const [niche, setNiche] = useState<Niche | null>(null);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });
  
  // DataGrid API reference for controlling panels
  const apiRef = useGridApiRef();

  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false);
  const [scrapeKeyword, setScrapeKeyword] = useState("");
  const [scrapeLocation, setScrapeLocation] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState<string>("20");
  const [scraping, setScraping] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  
  // No website action dialog state
  const [noWebsiteDialogOpen, setNoWebsiteDialogOpen] = useState(false);
  const [selectedContactForAction, setSelectedContactForAction] = useState<Row | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // SMS state
  const [smsMessage, setSmsMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  
  // Enrichment progress state
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<{
    total: number;
    processed: number;
    current: string | null;
    message: string;
    type: string;
    enriched_count?: number;
    skipped_count?: number;
  } | null>(null);
  
  // Handle sending WhatsApp via Twilio
  const handleSendWhatsApp = async () => {
    if (!selectedContactForAction || !smsMessage.trim()) return;
    
    setSendingSms(true);
    try {
      const response = await fetch(`http://localhost:8000/api/contacts/${selectedContactForAction.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsMessage }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert("WhatsApp message sent successfully!");
        setSmsMessage("");
        await fetchContacts();
        setNoWebsiteDialogOpen(false);
        setSelectedContactForAction(null);
      } else {
        alert(`Failed to send WhatsApp: ${data.message}`);
      }
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      alert("Failed to send WhatsApp message. Please check your Twilio configuration.");
    } finally {
      setSendingSms(false);
    }
  };
  
  // Alias for backward compatibility
  const handleSendSms = handleSendWhatsApp;

  // Handle view mode change
  const handleViewModeChange = (_event: MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Get rows with coordinates for map
  const mapRows = useMemo(() => 
    rows.filter(r => r.latitude && r.longitude), 
    [rows]
  );

  // Calculate map center from contacts
  const mapCenter = useMemo((): [number, number] => {
    if (mapRows.length === 0) return [51.505, -0.09]; // London default
    const avgLat = mapRows.reduce((sum, r) => sum + (r.latitude || 0), 0) / mapRows.length;
    const avgLng = mapRows.reduce((sum, r) => sum + (r.longitude || 0), 0) / mapRows.length;
    return [avgLat, avgLng];
  }, [mapRows]);

  // Fetch niche details
  const fetchNiche = useCallback(async () => {
    if (!nicheId) return;
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch niche");
      }
      const data: Niche = await response.json();
      setNiche(data);
    } catch (error) {
      console.error("Error fetching niche:", error);
      alert("Failed to load niche. It may not exist.");
      navigate("/crm");
    }
  }, [nicheId, navigate]);

  // Fetch contacts for this niche
  const fetchContacts = useCallback(async () => {
    if (!nicheId) return;
    setLoading(true);
    try {
      // Fetch all contacts (increase limit to 1000)
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/contacts?limit=1000`);
      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }
      const data: Contact[] = await response.json();
      
      const transformedRows: Row[] = data.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company,
        phone: contact.phone,
        address: contact.address,
        website: contact.website,
        rating: contact.rating,
        lastContact: contact.created_at ? new Date(contact.created_at) : null,
        status: contact.status,
        latitude: contact.latitude,
        longitude: contact.longitude,
        // Additional business details
        description: contact.description,
        openingHours: contact.opening_hours,
        services: contact.services,
        products: contact.products,
        priceRange: contact.price_range,
        googleMapsUrl: contact.google_maps_url,
        placeId: contact.place_id,
        category: contact.category,
        reviewsCount: contact.reviews_count,
        reviews: contact.reviews,
      }));
      
      setRows(transformedRows);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      alert("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [nicheId]);

  useEffect(() => {
    fetchNiche();
    fetchContacts();
  }, [fetchNiche, fetchContacts]);

  const handleScrapeOpen = () => {
    // Prefill with niche name and first location
    if (niche) {
      setScrapeKeyword(niche.name);
      if (niche.locations && niche.locations.length > 0) {
        setScrapeLocation(niche.locations[0]);
      }
    }
    setScrapeDialogOpen(true);
  };

  const handleScrapeClose = () => {
    setScrapeDialogOpen(false);
    setScrapeKeyword("");
    setScrapeLocation("");
  };

  const handleScrapeSubmit = async () => {
    setScraping(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: scrapeKeyword,
          location: scrapeLocation,
          limit: parseInt(scrapeLimit) || 20,
        }),
      });

      if (!response.ok) throw new Error("Failed to scrape data");

      const data = await response.json();
      console.log("Scrape successful:", data);
      
      await fetchContacts();
      await fetchNiche();
      handleScrapeClose();
    } catch (error) {
      console.error("Scraping error:", error);
      alert("Failed to scrape data.");
    } finally {
      setScraping(false);
    }
  };

  const handleEnrichEmails = async () => {
    if (!confirm("This will find missing emails from business websites. Continue?")) return;
    
    setEnriching(true);
    setEnrichmentDialogOpen(true);
    setEnrichmentProgress({ total: 0, processed: 0, current: null, message: "Starting...", type: "start" });
    
    try {
      // Use SSE endpoint for real-time progress
      const eventSource = new EventSource(`http://localhost:8000/api/niches/${nicheId}/enrich-emails/stream`);
      
      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        setEnrichmentProgress(data);
        
        // If complete or error, close the connection
        if (data.type === "complete" || data.type === "error") {
          eventSource.close();
          setEnriching(false);
          await fetchContacts();
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setEnriching(false);
        setEnrichmentProgress(prev => prev ? { ...prev, type: "error", message: "Connection lost" } : null);
      };
      
    } catch (error) {
      console.error("Enrichment error:", error);
      setEnriching(false);
      setEnrichmentProgress(prev => prev ? { ...prev, type: "error", message: String(error) } : null);
    }
  };

  const handleResetNAEmails = async () => {
    if (!confirm("This will reset all emails marked as 'N/A' back to null, allowing them to be enriched again. Continue?")) return;
    
    setResetting(true);
    try {
      const response = await fetch("http://localhost:8000/api/reset-na-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to reset emails");

      const data = await response.json();
      await fetchContacts();
      alert(`Reset ${data.reset_count} email(s) from N/A to null`);
    } catch (error) {
      console.error("Reset error:", error);
      alert("Failed to reset emails.");
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAllContacts = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL contacts in this niche. Continue?")) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/contacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete contacts");

      const data = await response.json();
      await fetchContacts();
      await fetchNiche();
      alert(`Deleted ${data.deleted_count} contact(s)`);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete contacts.");
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAllEmails = async () => {
    if (!confirm("This will clear ALL emails in this niche, setting them to null for re-enrichment. Continue?")) return;
    
    setClearing(true);
    try {
      const response = await fetch(`http://localhost:8000/api/niches/${nicheId}/clear-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to clear emails");

      const data = await response.json();
      await fetchContacts();
      alert(`Cleared ${data.cleared_count} email(s)`);
    } catch (error) {
      console.error("Clear error:", error);
      alert("Failed to clear emails.");
    } finally {
      setClearing(false);
    }
  };

  const getRowSpacing = useCallback((params: GridRowSpacingParams) => {
    return { top: params.isFirstVisible ? 0 : 5, bottom: 5 };
  }, []);

  // Handle no website action (call or SMS)
  const handleNoWebsiteAction = async (action: "call" | "sms") => {
    if (!selectedContactForAction) return;
    
    setUpdatingStatus(true);
    try {
      const newStatus = action === "call" ? "Website call made" : "Website SMS sent";
      const response = await fetch(`http://localhost:8000/api/contacts/${selectedContactForAction.id}/add-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      await fetchContacts();
      setNoWebsiteDialogOpen(false);
      setSelectedContactForAction(null);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update contact status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Extract area name from address (removes postcodes)
  const getAreaFromAddress = (address: string | null): string => {
    if (!address) return "your area";
    
    // Full UK postcode regex (matches: B8 2LL, SW1A 1AA, M1 1AA, EC1A 1BB, W1A 0AX, etc.)
    // This captures most UK postcode formats
    const fullPostcodeRegex = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/gi;
    
    // Remove any postcodes from the address string first
    let cleanAddress = address.replace(fullPostcodeRegex, "").trim();
    
    // Split by comma
    const parts = cleanAddress.split(",").map(p => p.trim()).filter(p => p.length > 0);
    
    // Look for a city/town name (skip street addresses that start with numbers)
    for (const part of parts) {
      // Skip if it starts with a number (likely a street address)
      if (/^\d/.test(part)) continue;
      // Skip if it's "UK" or "United Kingdom"
      if (/^(UK|United Kingdom|England|Scotland|Wales)$/i.test(part)) continue;
      // Skip if it's too short
      if (part.length < 3) continue;
      // Skip if it contains numbers (partial postcodes or street numbers)
      if (/\d/.test(part)) continue;
      // This looks like a valid area name
      return part;
    }
    
    // If nothing found, try to get the second part (often the city)
    if (parts.length >= 2 && !/^\d/.test(parts[1]) && parts[1].length > 2) {
      return parts[1];
    }
    
    return "your area";
  };

  // Generate prefilled WhatsApp message
  const generateWhatsAppMessage = (row: Row): string => {
    const area = getAreaFromAddress(row.address);
    return `Hi,

This is John from NeuroSphere, a London based digital media agency. I was looking into local businesses in ${area} that had amazing reviews but no website.

Would you be interested in a FREE website for your business? If yes book a call with us today and we will develop an amazing free website for you.

Book here: https://calendly.com/john-neurosphere/30min`;
  };

  // Open no website dialog
  const openNoWebsiteDialog = (row: Row) => {
    setSelectedContactForAction(row);
    setSmsMessage(generateWhatsAppMessage(row));
    setNoWebsiteDialogOpen(true);
  };

  const columns: GridColDef<(typeof rows)[number]>[] = [
    {
      field: "id",
      headerName: "ID",
      width: 120,
      type: "string",
    },
    {
      field: "name",
      headerName: "Name",
      width: 250,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        // Use place_id for direct link, otherwise fallback to googleMapsUrl or search
        const row = params.row;
        let googleMapsUrl: string;
        if (row.placeId) {
          // Place ID gives the most accurate direct link
          googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${row.placeId}`;
        } else if (row.googleMapsUrl) {
          googleMapsUrl = row.googleMapsUrl;
        } else {
          // Last resort - search by name and address
          const searchQuery = row.address 
            ? `${params.value}, ${row.address}` 
            : params.value || "";
          googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        }
        return (
          <Box className="flex h-full items-center gap-2">
            <Avatar className="bg-primary/80" alt={params.value} src={params.row.avatar}>
              {params.value?.substring(0, 1)}
            </Avatar>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {params.value}
            </a>
          </Box>
        );
      },
    },
    { field: "email", headerName: "Email", type: "string", width: 220 },
    { field: "company", headerName: "Company", width: 180, type: "string" },
    { field: "phone", headerName: "Phone", width: 160, type: "string" },
    { field: "address", headerName: "Address", width: 250, type: "string" },
    {
      field: "website",
      headerName: "Website",
      width: 200,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        if (params.value) {
          return (
            <a href={params.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {params.value}
            </a>
          );
        }
        // Show "No website" button when no website
        return (
          <Button 
            size="tiny" 
            color="primary" 
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              openNoWebsiteDialog(params.row);
            }}
          >
            No website
          </Button>
        );
      },
    },
    {
      field: "rating",
      headerName: "Rating",
      width: 100,
      type: "number",
      renderCell: (params: GridRenderCellParams<any, number>) => {
        if (params.value) {
          return (
            <Box className="flex h-full items-center gap-1.5">
              <span className="text-base leading-none">⭐</span>
              <Typography variant="body2" className="leading-none">{params.value.toFixed(1)}</Typography>
            </Box>
          );
        }
        return null;
      },
    },
    {
      field: "reviewsCount",
      headerName: "Reviews",
      width: 100,
      type: "number",
      renderCell: (params: GridRenderCellParams<any, number>) => {
        if (params.value !== null && params.value !== undefined) {
          return (
            <Box className="flex h-full items-center gap-1.5">
              <span className="text-base leading-none">💬</span>
              <Typography variant="body2" className="leading-none">{params.value}</Typography>
            </Box>
          );
        }
        return null;
      },
    },
    {
      field: "status",
      headerName: "Status",
      align: "left",
      headerAlign: "left",
      minWidth: 200,
      flex: 1,
      type: "string",
      renderCell: (params: GridRenderCellParams<any, string>) => {
        const value = params.value || "";
        // Split by comma to support multiple statuses
        const statuses = value.split(",").map(s => s.trim()).filter(s => s);
        
        if (statuses.length === 0) {
          return <Button className="pointer-events-none self-center" size="tiny" color="grey" variant="pastel" startIcon={<NiExclamationSquare size={"tiny"} />}>Unknown</Button>;
        }

        return (
          <Box className="flex h-full items-center gap-1 flex-wrap">
            {statuses.map((status, idx) => {
              if (status === "Active") {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="success" variant="pastel" startIcon={<NiCheckSquare size={"tiny"} />}>{status}</Button>;
              } else if (status === "Prospect") {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="warning" variant="pastel" startIcon={<NiClock size={"tiny"} />}>{status}</Button>;
              } else if (status === "Lead") {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="info" variant="pastel" startIcon={<NiMinusSquare size={"tiny"} />}>{status}</Button>;
              } else if (status === "Website call made") {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="primary" variant="pastel">📞 Called</Button>;
              } else if (status === "Website SMS sent") {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="secondary" variant="pastel">💬 SMS</Button>;
              } else {
                return <Button key={idx} className="pointer-events-none" size="tiny" color="grey" variant="pastel">{status}</Button>;
              }
            })}
          </Box>
        );
      },
    },
  ];

  // Search state for map view
  const [searchQuery, setSearchQuery] = useState("");
  
  // "No Website" filter state
  const [noWebsiteFilterActive, setNoWebsiteFilterActive] = useState(false);
  
  // DataGrid filter model state
  const [filterModel, setFilterModel] = useState<{ items: any[] }>({ items: [] });
  
  // Helper to apply a single filter item to a row
  const applyFilterItem = (row: Row, filter: any): boolean => {
    const value = row[filter.field as keyof Row];
    const filterValue = filter.value;
    
    if (filterValue === undefined || filterValue === null || filterValue === '') return true;
    
    switch (filter.operator) {
      case 'equals':
        return value === filterValue;
      case 'contains':
        return String(value || '').toLowerCase().includes(String(filterValue).toLowerCase());
      case 'startsWith':
        return String(value || '').toLowerCase().startsWith(String(filterValue).toLowerCase());
      case 'endsWith':
        return String(value || '').toLowerCase().endsWith(String(filterValue).toLowerCase());
      case 'isEmpty':
        return !value || value === '';
      case 'isNotEmpty':
        return value !== null && value !== undefined && value !== '';
      case '=':
        return Number(value) === Number(filterValue);
      case '!=':
        return Number(value) !== Number(filterValue);
      case '>':
        return Number(value) > Number(filterValue);
      case '>=':
        return Number(value) >= Number(filterValue);
      case '<':
        return Number(value) < Number(filterValue);
      case '<=':
        return Number(value) <= Number(filterValue);
      default:
        return true;
    }
  };
  
  // Filter rows based on search query, "No Website" filter, AND DataGrid filters
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply "No Website" filter
    if (noWebsiteFilterActive) {
      result = result.filter(r => r.email === "No website");
    }
    
    // Apply DataGrid filter model
    if (filterModel.items && filterModel.items.length > 0) {
      result = result.filter(row => 
        filterModel.items.every(filter => applyFilterItem(row, filter))
      );
    }
    
    return result;
  }, [rows, searchQuery, noWebsiteFilterActive, filterModel]);

  // Filter map rows based on search query
  const filteredMapRows = useMemo(() => {
    if (!searchQuery) return mapRows;
    const query = searchQuery.toLowerCase();
    return mapRows.filter(r => 
      r.name.toLowerCase().includes(query) ||
      r.email?.toLowerCase().includes(query)
    );
  }, [mapRows, searchQuery]);

  return (
    <>
      {/* Header Section - Always Visible */}
      <Grid container spacing={5} className="mb-4">
        <Grid container spacing={2.5} className="w-full" size={12}>
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {niche?.name || "Loading..."}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" to="/">Home</Link>
              <Link color="inherit" to="/crm">CRM</Link>
              <Typography variant="body2">{niche?.name}</Typography>
            </Breadcrumbs>
          </Grid>

          <Grid size={{ xs: 12, md: "auto" }} className="flex flex-row items-start gap-2">
            {/* View Toggle */}
            <Box className="border-grey-200 inline-flex rounded-2xl border border-solid p-1.75 mr-2">
              <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                <ToggleButton value="table">
                  <NiList size="small" />
                </ToggleButton>
                <ToggleButton value="map">
                  <NiSigns size="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Tooltip title="Scrape">
              <Button className="icon-only surface-standard" size="medium" color="primary" variant="surface" onClick={handleScrapeOpen} disabled={enriching}>
                <NiSearch size={"medium"} />
              </Button>
            </Tooltip>

            <Tooltip title="Enrich Emails">
              <Button className="icon-only surface-standard" size="medium" color="success" variant="surface" onClick={handleEnrichEmails} disabled={enriching || scraping}>
                <NiEmail size={"medium"} />
              </Button>
            </Tooltip>

            <Tooltip title="Reset N/A Emails">
              <Button className="icon-only surface-standard" size="medium" color="warning" variant="surface" onClick={handleResetNAEmails} disabled={enriching || scraping || resetting || deleting || clearing}>
                <NiArrowHistory size={"medium"} />
              </Button>
            </Tooltip>

            <Tooltip title="Clear All Emails">
              <Button className="icon-only surface-standard" size="medium" color="secondary" variant="surface" onClick={handleClearAllEmails} disabled={enriching || scraping || resetting || deleting || clearing}>
                <NiCrossSquare size={"medium"} />
              </Button>
            </Tooltip>

            <Tooltip title="Delete All Contacts">
              <Button className="icon-only surface-standard" size="medium" color="error" variant="surface" onClick={handleDeleteAllContacts} disabled={enriching || scraping || deleting}>
                <NiBinEmpty size={"medium"} />
              </Button>
            </Tooltip>
          </Grid>
        </Grid>

        {/* Search Bar */}
        <Grid size={12}>
          <FormControl variant="filled" size="medium" className="surface mb-0 w-full">
            <InputLabel>Search</InputLabel>
            <FilledInput 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              endAdornment={
                <>
                  <InputAdornment position="end" className={cn(searchQuery === "" && "hidden")}>
                    <IconButton edge="end" onClick={() => setSearchQuery("")}><NiCross size="medium" className="text-text-disabled" /></IconButton>
                  </InputAdornment>
                  <InputAdornment position="end" className={cn(searchQuery !== "" && "hidden")}>
                    <IconButton edge="end"><NiSearch size="medium" className="text-text-disabled" /></IconButton>
                  </InputAdornment>
                </>
              }
            />
          </FormControl>
        </Grid>
      </Grid>

      {/* No Website Action Dialog - Enhanced with full business details */}
      <Dialog open={noWebsiteDialogOpen} onClose={() => { setNoWebsiteDialogOpen(false); setSelectedContactForAction(null); setSmsMessage(""); }} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <span>{selectedContactForAction?.name}</span>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            {/* Send WhatsApp Section - At the top */}
            <Box className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <Typography variant="subtitle1" className="font-bold mb-3 flex items-center gap-2">
                <span>💬</span> Send WhatsApp Message
              </Typography>
              {selectedContactForAction?.phone ? (
                <>
                  <Typography variant="body2" className="mb-2">
                    Send a WhatsApp message to: <strong>{selectedContactForAction.phone}</strong>
                  </Typography>
                  <TextField
                    label="WhatsApp Message"
                    variant="outlined"
                    fullWidth
                    multiline
                    minRows={4}
                    maxRows={10}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Hi! I noticed your business doesn't have a website. I can help you create a professional website to attract more customers. Would you like to learn more?"
                    disabled={sendingSms}
                    className="mb-2"
                  />
                  <Button 
                    variant="contained" 
                    color="success" 
                    fullWidth
                    disabled={sendingSms || !smsMessage.trim()}
                    onClick={handleSendWhatsApp}
                    startIcon={<span>📲</span>}
                  >
                    {sendingSms ? "Sending WhatsApp..." : "Send via WhatsApp"}
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="error">
                  ⚠️ No phone number available for this contact.
                </Typography>
              )}
            </Box>

            {/* Business Details Section */}
            <Box className="rounded-lg border border-grey-200 bg-grey-50 p-4">
              <Typography variant="subtitle1" className="font-bold mb-3 flex items-center gap-2">
                <span>📋</span> Business Details (for website building)
              </Typography>
              
              <Grid container spacing={2}>
                {/* Basic Info */}
                <Grid size={12}>
                  <Typography variant="caption" className="text-text-secondary">Business Name</Typography>
                  <Typography variant="body2" className="font-medium">{selectedContactForAction?.name || "N/A"}</Typography>
                </Grid>
                
                {selectedContactForAction?.category && (
                  <Grid size={6}>
                    <Typography variant="caption" className="text-text-secondary">Category</Typography>
                    <Typography variant="body2">{selectedContactForAction.category}</Typography>
                  </Grid>
                )}
                
                {selectedContactForAction?.priceRange && (
                  <Grid size={6}>
                    <Typography variant="caption" className="text-text-secondary">Price Range</Typography>
                    <Typography variant="body2">{selectedContactForAction.priceRange}</Typography>
                  </Grid>
                )}
                
                {/* Contact Info */}
                {selectedContactForAction?.phone && (
                  <Grid size={6}>
                    <Typography variant="caption" className="text-text-secondary">📞 Phone</Typography>
                    <Typography variant="body2">{selectedContactForAction.phone}</Typography>
                  </Grid>
                )}
                
                {selectedContactForAction?.address && (
                  <Grid size={6}>
                    <Typography variant="caption" className="text-text-secondary">📍 Address</Typography>
                    <Typography variant="body2">{selectedContactForAction.address}</Typography>
                  </Grid>
                )}
                
                {/* Rating & Reviews */}
                {(selectedContactForAction?.rating || selectedContactForAction?.reviewsCount) && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">⭐ Rating & Reviews</Typography>
                    <Typography variant="body2">
                      {selectedContactForAction.rating?.toFixed(1) || "N/A"} stars 
                      {selectedContactForAction.reviewsCount ? ` (${selectedContactForAction.reviewsCount} reviews)` : ""}
                    </Typography>
                  </Grid>
                )}
                
                {/* Description */}
                {selectedContactForAction?.description && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">📝 Description</Typography>
                    <Typography variant="body2">{selectedContactForAction.description}</Typography>
                  </Grid>
                )}
                
                {/* Opening Hours */}
                {selectedContactForAction?.openingHours && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">🕐 Opening Hours</Typography>
                    <Box className="mt-1">
                      {/* Handle array of strings format */}
                      {Array.isArray(selectedContactForAction.openingHours.schedule) && 
                        selectedContactForAction.openingHours.schedule.map((hour, idx) => (
                          <Typography key={idx} variant="body2" className="text-sm">
                            {typeof hour === 'string' ? hour : `${hour.day}: ${hour.hours}`}
                          </Typography>
                        ))
                      }
                      {/* Handle direct array format */}
                      {Array.isArray(selectedContactForAction.openingHours) && 
                        selectedContactForAction.openingHours.map((hour: any, idx: number) => (
                          <Typography key={idx} variant="body2" className="text-sm">
                            {typeof hour === 'string' ? hour : `${hour.day || hour.dayRange || ''}: ${hour.hours || hour.time || ''}`}
                          </Typography>
                        ))
                      }
                    </Box>
                  </Grid>
                )}
                
                {/* Services */}
                {selectedContactForAction?.services && selectedContactForAction.services.length > 0 && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">🛠️ Services/Categories</Typography>
                    <Box className="flex flex-wrap gap-1 mt-1">
                      {selectedContactForAction.services.map((service, idx) => (
                        <Button key={idx} size="tiny" color="info" variant="pastel" className="pointer-events-none">
                          {service}
                        </Button>
                      ))}
                    </Box>
                  </Grid>
                )}
                
                {/* Products */}
                {selectedContactForAction?.products && selectedContactForAction.products.length > 0 && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">📦 Products</Typography>
                    <Box className="flex flex-wrap gap-1 mt-1">
                      {selectedContactForAction.products.map((product, idx) => (
                        <Button key={idx} size="tiny" color="success" variant="pastel" className="pointer-events-none">
                          {product}
                        </Button>
                      ))}
                    </Box>
                  </Grid>
                )}
                
                {/* Google Maps Link */}
                {selectedContactForAction?.googleMapsUrl && (
                  <Grid size={12}>
                    <Typography variant="caption" className="text-text-secondary">🗺️ Google Maps</Typography>
                    <Box>
                      <a href={selectedContactForAction.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                        View on Google Maps →
                      </a>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>

            {/* Reviews Section */}
            {selectedContactForAction?.reviews && selectedContactForAction.reviews.length > 0 && (
              <Box className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <Typography variant="subtitle1" className="font-bold mb-3 flex items-center gap-2">
                  <span>⭐</span> Customer Reviews ({selectedContactForAction.reviews.length})
                </Typography>
                <Box className="max-h-80 overflow-y-auto space-y-3">
                  {selectedContactForAction.reviews.map((review, idx) => (
                    <Box key={idx} className="rounded-lg bg-white p-3 border border-grey-200">
                      <Box className="flex items-center justify-between mb-2">
                        <Typography variant="body2" className="font-medium">{review.author || "Anonymous"}</Typography>
                        <Box className="flex items-center gap-1">
                          {review.rating && (
                            <Box className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={i < (review.rating || 0) ? "text-yellow-500" : "text-gray-300"}>★</span>
                              ))}
                            </Box>
                          )}
                          {review.date && (
                            <Typography variant="caption" className="text-text-secondary ml-2">{review.date}</Typography>
                          )}
                        </Box>
                      </Box>
                      {review.text && (
                        <Typography variant="body2" className="text-text-secondary mb-2">{review.text}</Typography>
                      )}
                      {review.response && (
                        <Box className="bg-blue-50 rounded p-2 mt-2">
                          <Typography variant="caption" className="font-medium text-blue-700">Owner Response:</Typography>
                          <Typography variant="body2" className="text-blue-800">{review.response}</Typography>
                        </Box>
                      )}
                      {review.likes && review.likes > 0 && (
                        <Typography variant="caption" className="text-text-secondary">👍 {review.likes} found this helpful</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Quick Actions */}
            <Box className="flex gap-2">
              <Button 
                variant="outlined" 
                color="grey" 
                fullWidth
                disabled={updatingStatus}
                onClick={() => handleNoWebsiteAction("call")}
                startIcon={<span>📞</span>}
              >
                {updatingStatus ? "Updating..." : "Mark as Called"}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setNoWebsiteDialogOpen(false); setSelectedContactForAction(null); setSmsMessage(""); }} color="grey" variant="text" disabled={updatingStatus || sendingSms}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enrichment Progress Dialog */}
      <Dialog open={enrichmentDialogOpen} onClose={() => !enriching && setEnrichmentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box className="flex items-center gap-2">
            <span className="text-2xl">✉️</span>
            <span>Email Enrichment</span>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            {enrichmentProgress && (
              <>
                {/* Progress Bar */}
                <Box>
                  <Box className="mb-2 flex items-center justify-between">
                    <Typography variant="body2" className="text-text-secondary">
                      {enrichmentProgress.type === "complete" ? "Complete!" : enrichmentProgress.type === "error" ? "Error" : "Processing..."}
                    </Typography>
                    <Typography variant="body2" className="font-medium">
                      {enrichmentProgress.processed} / {enrichmentProgress.total}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={enrichmentProgress.total > 0 ? (enrichmentProgress.processed / enrichmentProgress.total) * 100 : 0}
                    color={enrichmentProgress.type === "complete" ? "success" : enrichmentProgress.type === "error" ? "error" : "primary"}
                  />
                </Box>

                {/* Current Contact */}
                {enrichmentProgress.current && enrichmentProgress.type !== "complete" && (
                  <Box className="rounded-lg bg-grey-50 p-3">
                    <Typography variant="caption" className="text-text-secondary">Currently processing:</Typography>
                    <Typography variant="body1" className="font-medium">{enrichmentProgress.current}</Typography>
                    <Typography variant="body2" className="text-text-secondary mt-1">{enrichmentProgress.message}</Typography>
                  </Box>
                )}

                {/* Completion Summary */}
                {enrichmentProgress.type === "complete" && (
                  <Box className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <Typography variant="subtitle1" className="font-bold text-green-800 mb-2">✅ Enrichment Complete!</Typography>
                    <Box className="flex flex-wrap gap-4">
                      <Box>
                        <Typography variant="caption" className="text-green-700">Emails Found</Typography>
                        <Typography variant="h6" className="text-green-800 font-bold">{enrichmentProgress.enriched_count || 0}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" className="text-grey-600">Skipped</Typography>
                        <Typography variant="h6" className="text-grey-700">{enrichmentProgress.skipped_count || 0}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" className="text-grey-600">Total</Typography>
                        <Typography variant="h6" className="text-grey-700">{enrichmentProgress.total}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Error Message */}
                {enrichmentProgress.type === "error" && (
                  <Box className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <Typography variant="subtitle1" className="font-bold text-red-800 mb-1">❌ Error</Typography>
                    <Typography variant="body2" className="text-red-700">{enrichmentProgress.message}</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setEnrichmentDialogOpen(false)} 
            color="grey" 
            variant="text" 
            disabled={enriching}
          >
            {enriching ? "Processing..." : "Close"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scrapeDialogOpen} onClose={handleScrapeClose} maxWidth="sm" fullWidth>
        <DialogTitle>{scraping ? "Scraping..." : `Scrape for ${niche?.name}`}</DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-4 pt-2">
            <TextField label="Keyword" variant="outlined" fullWidth value={scrapeKeyword} onChange={(e) => setScrapeKeyword(e.target.value)} placeholder="e.g., hvac, restaurants, plumbers" disabled={scraping} />
            <TextField label="Location" variant="outlined" fullWidth value={scrapeLocation} onChange={(e) => setScrapeLocation(e.target.value)} placeholder="e.g., London, New York" disabled={scraping} />
            <TextField label="Number of Records" variant="outlined" fullWidth type="number" value={scrapeLimit} onChange={(e) => setScrapeLimit(e.target.value)} inputProps={{ min: 1, max: 50 }} helperText="1-50 records" disabled={scraping} />
            {scraping && <Box className="flex items-center justify-center gap-2 py-4"><Typography variant="body2" color="text.secondary">Scraping data, please wait...</Typography></Box>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScrapeClose} color="grey" variant="text" disabled={scraping}>Cancel</Button>
          <Button onClick={handleScrapeSubmit} color="primary" variant="contained" disabled={!scrapeKeyword || !scrapeLocation || scraping}>{scraping ? "Scraping..." : "Scrape"}</Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={5}>
        {rows.length > 0 && (
          <Grid size={12}>
            <Box className="mb-4 rounded-lg bg-surface-container p-4">
              <Box className="mb-2 flex items-center justify-between">
                <Typography variant="body2" className="text-text-secondary">Email Enrichment Status</Typography>
                <Typography variant="body2" className="font-medium">
                  {rows.length} contacts total
                </Typography>
              </Box>
              
              {/* Multi-color progress bar */}
              {(() => {
                const statusMessages = ["no email found", "No website", "website error", "N/A"];
                const withEmail = rows.filter(r => r.email && !statusMessages.includes(r.email)).length;
                const noEmailFound = rows.filter(r => r.email === "no email found" || r.email === "N/A").length;
                const noWebsite = rows.filter(r => r.email === "No website").length;
                const websiteError = rows.filter(r => r.email === "website error").length;
                const notChecked = rows.filter(r => !r.email).length;
                
                const total = rows.length;
                const greenWidth = (withEmail / total) * 100;
                const redWidth = (noEmailFound / total) * 100;
                const blueWidth = (noWebsite / total) * 100;
                const orangeWidth = (websiteError / total) * 100;
                const greyWidth = (notChecked / total) * 100;
                
                return (
                  <>
                    <Box className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      {greenWidth > 0 && (
                        <Box 
                          className="bg-green-500 transition-all" 
                          style={{ width: `${greenWidth}%` }}
                          title={`${withEmail} with email`}
                        />
                      )}
                      {redWidth > 0 && (
                        <Box 
                          className="bg-red-500 transition-all" 
                          style={{ width: `${redWidth}%` }}
                          title={`${noEmailFound} no email found`}
                        />
                      )}
                      {blueWidth > 0 && (
                        <Box 
                          className="bg-blue-500 transition-all" 
                          style={{ width: `${blueWidth}%` }}
                          title={`${noWebsite} no website`}
                        />
                      )}
                      {orangeWidth > 0 && (
                        <Box 
                          className="bg-orange-500 transition-all" 
                          style={{ width: `${orangeWidth}%` }}
                          title={`${websiteError} website error`}
                        />
                      )}
                      {greyWidth > 0 && (
                        <Box 
                          className="bg-gray-400 transition-all" 
                          style={{ width: `${greyWidth}%` }}
                          title={`${notChecked} not checked`}
                        />
                      )}
                    </Box>
                    <Box className="mt-2 flex flex-wrap items-center gap-4">
                      <Box className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 rounded-full bg-green-500" />
                        <Typography variant="caption" className="text-text-secondary">{withEmail} emails</Typography>
                      </Box>
                      <Box className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 rounded-full bg-red-500" />
                        <Typography variant="caption" className="text-text-secondary">{noEmailFound} no email</Typography>
                      </Box>
                      <Box className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 rounded-full bg-blue-500" />
                        <Typography variant="caption" className="text-text-secondary">{noWebsite} no website</Typography>
                      </Box>
                      <Box className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 rounded-full bg-orange-500" />
                        <Typography variant="caption" className="text-text-secondary">{websiteError} site error</Typography>
                      </Box>
                      <Box className="flex items-center gap-1.5">
                        <Box className="h-3 w-3 rounded-full bg-gray-400" />
                        <Typography variant="caption" className="text-text-secondary">{notChecked} pending</Typography>
                      </Box>
                    </Box>
                  </>
                );
              })()}
            </Box>
          </Grid>
        )}
        {viewMode === "map" ? (
          <Grid size={12}>
            {/* Inject CSS for magnifying glass cursor */}
            <style>{mapCursorStyle}</style>
            <Box className="rounded-lg overflow-hidden" style={{ height: "600px" }}>
              <MapContainer 
                center={mapCenter} 
                zoom={11} 
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                className="map-scrape-mode"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Map click handler for scraping */}
                <MapClickHandler 
                  nicheName={niche?.name || ""} 
                  onLocationClick={async (lat, lng) => {
                    const location = await reverseGeocode(lat, lng);
                    setScrapeKeyword(niche?.name || "");
                    setScrapeLocation(location);
                    setScrapeDialogOpen(true);
                  }} 
                />
                {filteredMapRows.map((row) => (
                  <Marker 
                    key={row.id} 
                    position={[row.latitude!, row.longitude!]}
                  >
                    <Popup>
                      <Box className="min-w-[200px]">
                        <Typography variant="subtitle2" className="font-bold">{row.name}</Typography>
                        {row.address && (
                          <Typography variant="body2" className="text-gray-600">{row.address}</Typography>
                        )}
                        {row.phone && (
                          <Typography variant="body2">📞 {row.phone}</Typography>
                        )}
                        {row.email && (
                          <Typography variant="body2">✉️ {row.email}</Typography>
                        )}
                        {row.rating && (
                          <Typography variant="body2">⭐ {row.rating.toFixed(1)}</Typography>
                        )}
                        {row.website && (
                          <a href={row.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                            🌐 Website
                          </a>
                        )}
                      </Box>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Box>
            <Typography variant="caption" className="text-text-secondary mt-2 block text-center">
              💡 Click anywhere on the map to scrape businesses in that area
            </Typography>
          </Grid>
        ) : (
          <Grid size={12} className="overflow-hidden">
            <DataGrid
              apiRef={apiRef}
              rows={filteredRows}
              columns={columns}
              initialState={{ columns: { columnVisibilityModel: { avatar: false } }, pagination: { paginationModel: { pageSize: 10 } } }}
              getRowSpacing={getRowSpacing}
              rowHeight={68}
              columnHeaderHeight={32}
              checkboxSelection
              disableRowSelectionOnClick
              pageSizeOptions={[10]}
              className="full-page border-none"
              pagination
              showToolbar
              slotProps={{ panel: { className: "mt-1!" }, main: { className: "min-h-[600px]!" } }}
              slots={{
                toolbar: function CustomToolbar() {
                  // Export filtered rows - just use filteredRows state directly!
                  const handleExportCsv = () => {
                    if (filteredRows.length === 0) {
                      alert("No rows to export");
                      return;
                    }
                    
                    // Create CSV content with index
                    const csv = filteredRows.map((r, idx) => 
                      `${idx + 1},"${(r.name || '').replace(/"/g, '""')}","${(r.email || '').replace(/"/g, '""')}","${(r.phone || '').replace(/"/g, '""')}","${(r.address || '').replace(/"/g, '""')}","${(r.website || '').replace(/"/g, '""')}"`
                    ).join('\n');
                    
                    const blob = new Blob([`Index,Name,Email,Phone,Address,Website\n${csv}`], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${niche?.name || 'contacts'}_filtered_${filteredRows.length}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  };
                  
                  return (
                    <Toolbar className="mb-4">
                      <Box className="flex items-center gap-2">
                        <Tooltip title="Columns">
                          <ColumnsPanelTrigger render={(props) => (
                            <Button {...props} className="icon-only surface-standard flex-none" size="medium" color="grey" variant="surface">
                              <NiCols size={"medium"} />
                            </Button>
                          )} />
                        </Tooltip>
                        <Tooltip title="Filters">
                          <FilterPanelTrigger render={(props, state) => (
                            <Button {...props} className="icon-only surface-standard flex-none" size="medium" color="grey" variant="surface">
                              <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                                <NiFilter size={"medium"} />
                              </Badge>
                            </Button>
                          )} />
                        </Tooltip>
                        <Tooltip title="Filter: No Website">
                          <Button 
                            className="surface-standard flex-none" 
                            size="medium" 
                            color={noWebsiteFilterActive ? "primary" : "grey"}
                            variant={noWebsiteFilterActive ? "contained" : "surface"}
                            onClick={() => setNoWebsiteFilterActive(!noWebsiteFilterActive)}
                          >
                            🌐 No Website
                          </Button>
                        </Tooltip>
                        <Tooltip title="Export CSV (filtered)">
                          <Button 
                            className="icon-only surface-standard flex-none" 
                            size="medium" 
                            color="grey" 
                            variant="surface"
                            onClick={handleExportCsv}
                          >
                            <NiArrowInDown size={"medium"} />
                          </Button>
                        </Tooltip>
                      </Box>
                    </Toolbar>
                  );
                },
                basePagination: DataGridPaginationFullPage,
                columnSortedDescendingIcon: () => <NiArrowDown size={"small"} />,
                columnSortedAscendingIcon: () => <NiArrowUp size={"small"} />,
                columnFilteredIcon: () => <NiFilterPlus size={"small"} />,
                columnReorderIcon: () => <NiChevronLeftRightSmall size={"small"} />,
                columnMenuIcon: () => <NiEllipsisVertical size={"small"} />,
                columnMenuSortAscendingIcon: NiArrowUp,
                columnMenuSortDescendingIcon: NiArrowDown,
                columnMenuFilterIcon: NiFilter,
                columnMenuHideIcon: NiEyeInactive,
                columnMenuClearIcon: NiCross,
                columnMenuManageColumnsIcon: NiCols,
                filterPanelDeleteIcon: NiCross,
                filterPanelRemoveAllIcon: NiBinEmpty,
                baseSelect: (props: any) => {
                  const propsCasted = props as SelectProps;
                  return <FormControl size="small" variant="outlined"><InputLabel>{props.label}</InputLabel><Select {...propsCasted} IconComponent={NiChevronDownSmall} MenuProps={{ className: "outlined" }} /></FormControl>;
                },
                quickFilterIcon: () => <NiSearch size={"medium"} />,
                quickFilterClearIcon: () => <NiCross size={"medium"} />,
                baseButton: (props) => <Button {...props} variant="pastel" color="grey" />,
                moreActionsIcon: () => <NiEllipsisVertical size={"medium"} />,
              }}
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={(model) => setRowSelectionModel(model)}
              onFilterModelChange={(model) => setFilterModel(model)}
              hideFooterSelectedRowCount
            />
          </Grid>
        )}
      </Grid>
    </>
  );
}
