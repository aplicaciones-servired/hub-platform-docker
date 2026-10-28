"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import UserSummaryCards from "@/components/UserSummaryCards";
import UserFilters from "@/components/UserFilters";
import UsersTable from "@/components/UsersTable";
import EditUserModal from "@/components/EditUserModal";
import CreateUserModal from "@/components/CreateUserModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/hooks/useModal";
import Pagination from "@/components/Pagination";
import type { ApiUser } from "@hub/shared/types/user";

const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 350;

interface UsersResponse {
  items: ApiUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: { total: number; admin: number; user: number; tecnico: number; asesor: number };
}

export default function UsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const { modal, showAlert, showConfirm, closeModal } = useModal();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [counts, setCounts] = useState({ total: 0, admin: 0, user: 0, tecnico: 0, asesor: 0 });
  const [serverTotal, setServerTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get("create") === "true");
  const [resetPasswordUser, setResetPasswordUser] = useState<ApiUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateModal(true);
      router.replace("/dashboard/users");
    }
  }, [searchParams, router]);

  const fetchPage = useCallback((targetPage: number, search: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(PER_PAGE) });
    if (search.trim()) params.set("search", search.trim());
    api
      .get<UsersResponse>(`/users?${params.toString()}`)
      .then((data) => {
        setUsers(Array.isArray(data?.items) ? data.items : []);
        setServerTotal(typeof data?.total === "number" ? data.total : 0);
        setTotalPages(Math.max(1, data?.totalPages ?? 1));
        if (data?.counts) setCounts(data.counts);
        // La búsqueda puede reducir el total de páginas: volver a la última válida
        if (data?.items?.length === 0 && targetPage > 1) {
          setPage(Math.max(1, data?.totalPages ?? 1));
        }
      })
      .catch((err) => logger.error("Error fetching users", { error: err instanceof Error ? err.message : err }))
      .finally(() => setLoading(false));
  }, []);

  // Búsqueda con debounce contra el servidor: al cambiar, vuelve a la página 1
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetchPage(page, debouncedSearch);
    const interval = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        fetchPage(page, debouncedSearch);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [page, debouncedSearch, fetchPage]);

  const handleToggleStatus = useCallback(async (user: ApiUser) => {
    setActionLoading(user.id);
    try {
      const updated = await api.patch<ApiUser>(`/users/${user.id}/toggle-status`);
      fetchPage(page, debouncedSearch);
      showToast(updated.estado === "activo" ? "Usuario activado" : "Usuario bloqueado");
    } catch (err) {
      logger.error("Toggle status error", { error: err instanceof Error ? err.message : err });
    } finally {
      setActionLoading(null);
    }
  }, [page, debouncedSearch, fetchPage, showToast]);

  const handleRefresh = useCallback(() => {
    fetchPage(page, debouncedSearch);
  }, [page, debouncedSearch, fetchPage]);

  const handleDelete = useCallback((target: ApiUser) => {
    showConfirm(
      "Eliminar usuario",
      `¿Deseas eliminar a ${target.nombre}? Esta acción desactivará su cuenta y no podrá iniciar sesión. Los tickets que tenga asignados quedarán sin técnico.`,
      async () => {
        setActionLoading(target.id);
        try {
          await api.delete(`/users/${target.id}`);
          fetchPage(page, debouncedSearch);
          showToast("Usuario eliminado");
        } catch (err) {
          logger.error("Delete user error", { error: err instanceof Error ? err.message : err });
          showAlert("No se pudo eliminar el usuario", err instanceof Error ? err.message : "Intenta de nuevo.", "error");
        } finally {
          setActionLoading(null);
        }
      },
      "Eliminar"
    );
  }, [debouncedSearch, fetchPage, page, showAlert, showConfirm, showToast]);

  return (
    <div className="bg-[#F8F8FC] dark:bg-gray-950 min-h-[calc(100vh-72px)] p-8">
      <UserSummaryCards
        totalUsers={counts.total}
        adminCount={counts.admin}
        userCount={counts.user}
        loading={loading && counts.total === 0}
      />

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[36px] font-bold text-[#25207E] font-inter">
          Gestión de Usuarios
        </h1>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-4 bg-[#25207E] border-none rounded-lg cursor-pointer text-[13px] font-semibold font-inter text-white"
          >
            <RefreshCw size={16} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
            Refrescar
          </button>

          <UserFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      </div>

      <UsersTable
        users={users}
        currentUserId={currentUser?.id ?? ""}
        canManageUsers={currentUser?.rol === "admin"}
        onEdit={setEditingUser}
        onToggleStatus={handleToggleStatus}
        onResetPassword={setResetPasswordUser}
        onDelete={handleDelete}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={serverTotal}
        from={serverTotal === 0 ? 0 : Math.min((page - 1) * PER_PAGE + 1, serverTotal)}
        to={Math.min(page * PER_PAGE, serverTotal)}
        itemLabel="usuarios"
        onPageChange={setPage}
      />

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setPage(1);
            fetchPage(1, debouncedSearch);
            showToast("Usuario creado");
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setUsers((prev) => (Array.isArray(prev) ? prev : []).map((u) => (u.id === updated.id ? updated : u)));
            setEditingUser(null);
            showToast("Usuario actualizado");
          }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          userId={resetPasswordUser.id}
          userDocument={resetPasswordUser.documento}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            fetchPage(page, debouncedSearch);
            showToast("Contraseña restablecida");
          }}
        />
      )}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showCancel={modal.showCancel}
      />
    </div>
  );
}
