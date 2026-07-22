

import { Link } from "@/i18n/routing";
import { IconHome, IconChevronRight  } from '@tabler/icons-react';

export default function AccountDeletion() {
    return (

        <div className="min-h-screen mx-auto w-full pb-2 pt-4 bg-muted">
            <div className="px-4 bg-muted">
                <div className="max-w-7xl mx-auto w-full pb-2">
                    <nav className="flex items-center gap-2 text-base">
                        <Link
                            href="/"
                            className="group flex items-center transition-colors duration-150 text-foreground dark:text-gray-400 hover:text-blue-300">
                            <IconHome size={16} className="text-foreground dark:text-gray-400 group-hover:text-blue-300" />
                            <span className="text-foreground dark:text-gray-400 group-hover:text-blue-300 pl-1.5">Home</span>
                        </Link>
                        <IconChevronRight size={16} className="block text-muted-foreground"/>
                        <h1 className="text-muted-foreground dark:text-gray-400">Account Deletion</h1>
                    </nav>
                </div>
            </div>
            <main className="w-full bg-muted">
                <div className="pt-2 pb-32">
                    <div className="max-w-4xl mx-auto px-6 md:px-8 lg:px-1">
                        <div className="bg-card rounded-sm border border-border p-4">
                            <h2 className="text-2xl font-medium mb-6 mt-2 text-center">
                                How do I delete my PSA-NPIC account?
                            </h2>
                            <div className="mb-3 px-3">
                                <h3 className="font-semibold mb-2">If you want to disconnect Facebook account</h3>
                                <p className="text-foreground leading-relaxed mb-3">
                                    The following Facebook account disconnection steps are available in the PSA-NPIC app and website. To disconnect your Facebook account, follow these steps:
                                </p>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li>Log in to PSA-NPIC using the account you will like to disconnect</li>
                                    <li>Go to your profile</li>
                                    <li>Click on the settings icon</li>
                                    <li>Select "Facebook"</li>
                                    <li>Select "Disconnect"</li>
                                </ol>
                            </div>
                            <div className="mb-4 px-3">
                                <h3 className="font-semibold mb-2">If you want to disconnect Google account</h3>
                                <p className="text-foreground leading-relaxed mb-3">
                                    The following Google account disconnection steps are available in the PSA-NPIC app and website. To disconnect your Google account, follow these steps:
                                </p>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li>Log in to PSA-NPIC using the account you will like to disconnect</li>
                                    <li>Go to your profile</li>
                                    <li>Click on the settings icon</li>
                                    <li>Select "Google"</li>
                                    <li>Select "Disconnect"</li>
                                </ol>
                            </div>
                            <div className="mb-4 px-3">
                                <h3 className="font-semibold mb-2">If you are sure you want to delete PSA-NPIC Account</h3>
                                <p className="text-foreground leading-relaxed mb-3">
                                    The following account deletion steps are available in the PSA-NPIC app and website. To delete your account, follow these steps:
                                </p>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li>Log in to PSA-NPIC using the account you will like to delete</li>
                                    <li>Go to your profile</li>
                                    <li>Click on the settings icon</li>
                                    <li>Select "Delete Account"</li>
                                    <li>Select "Delete"</li>
                                    <li>Enter your password to confirm your deletion and then select "Delete"</li>
                                </ol>
                                <p className="text-foreground leading-relaxed mt-3">
                                    Your account will be deactivated and won't be visible to the public. During deactivation, you can reactivate your account anytime. After 90 days, your data will be deleted permanently.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}