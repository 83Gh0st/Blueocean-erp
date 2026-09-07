import { requireUser } from "@/lib/require-user";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>My Account</h1>
          <p>Signed in as {user.name} ({user.email}).</p>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="panel-head">
          <h2>Change password</h2>
        </div>
        <ChangePasswordForm />
      </div>
    </>
  );
}
