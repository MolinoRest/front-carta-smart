import NavbarComponent from "@/components/navbar";
import Link from "next/link";

const HomeView = () => {
    return (
        <div className="w-full">
            <NavbarComponent></NavbarComponent>
            <div className="w-full h-[100vh] flex justify-center items-center">

                <div className="w-full flex flex-col space-y-8">
                    <div className="w-full flex justify-center">
                        <h1 className="text-center md:text-[96px] text-[48px] font-bold text-black">CARTA SMART</h1>
                    </div>
                    <div className="flex md:flex-row flex-col justify-center md:space-x-8 md:space-y-0 space-y-4 px-4">

                        <Link href={"/view-menu"}>
                            <div className="border-2 rounded-2xl border-gray-600 px-3 py-1 hover:bg-[#f7ac29] transition-colors duration-300 ease-in-out md:min-w-[300px] min-w-[250px]">
                                <p className="md:text-[32px] text-[24px] text-center">Ver menús</p>
                            </div>
                        </Link>
                        <Link href={"/edit-menu"}>
                            <div className="border-2 rounded-2xl border-gray-600 px-3 py-1 hover:bg-[#f7ac29] transition-colors duration-300 ease-in-out md:min-w-[300px] min-w-[250px]">
                                <p className="md:text-[32px] text-[24px] text-center">Gestionar menús</p>
                            </div>
                        </Link>
                        <Link href={"/chat-bot"}>
                            <div className="border-2 rounded-2xl border-gray-600 px-3 py-1 hover:bg-[#f7ac29] transition-colors duration-300 ease-in-out md:min-w-[300px] min-w-[250px]">
                                <p className="md:text-[32px] text-[24px] text-center">Chat bot</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>

    );
}

export default HomeView;