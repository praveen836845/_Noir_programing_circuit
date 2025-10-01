import React from "react";
import Head from "next/head";
import MessageList from "../components/message-list";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>WhisperWall - Anonymous workplace conversations</title>
      </Head>

      <div className="home-page">
        <MessageList showMessageForm />
      </div>
    </>
  );
}
