import Link from "next/link";

const HomeView = () => {
    return <div>
        <div>
            <div>
                <h1>CARTA SMART</h1>
            </div>
            <div>
                <Link href={"/view-menu"}>Ver carta</Link>
                <Link href={"/edit-menu"}>Gestionar carta</Link>
                <Link href={"/chat-bot"}>Chat bot</Link>
            </div>
        </div>
    </div>
}

export default HomeView;