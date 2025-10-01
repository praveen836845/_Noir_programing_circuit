import React, { useRef, useState } from "react";
import Image from "next/image";
import TimeAgo from "javascript-time-ago";
import Link from "next/link";
import IonIcon from "@reacticons/ionicons";
import type { SignedMessageWithProof } from "../lib/types";
import { generateNameFromPubkey } from "../lib/utils";
import { setMessageLiked, isMessageLiked } from "../lib/store";
import { toggleLike } from "../lib/api";
import { hasEphemeralKey } from "../lib/ephemeral-key";
import { Providers } from "../lib/providers";

interface MessageCardProps {
  message: SignedMessageWithProof;
  isInternal?: boolean;
}


const MessageCard: React.FC<MessageCardProps> = ({ message, isInternal }) => {
  const timeAgo = useRef(new TimeAgo("en-US")).current;

  const provider = Providers[message.anonGroupProvider];
  const anonGroup = provider.getAnonGroup(message.anonGroupId);

  // States
  const [likeCount, setLikeCount] = useState(message.likes || 0);
  const [isLiked, setIsLiked] = useState(() => {
    const liked = isMessageLiked(message.id);
    console.log(`Initial like state for message ${message.id}: ${liked}`);
    return liked;
  });

  const isGroupPage = window.location.pathname === `/${provider.getSlug()}/${message.anonGroupId}`;
  const isMessagePage = window.location.pathname === `/messages/${message.id}`;

  // Check if user has ephemeral key for authentication
  const hasAuth = hasEphemeralKey();

  // Handlers
  async function onLikeClick() {
    if (!hasAuth) {
      return;
    }
    
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    // Optimistic update
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);
    setMessageLiked(message.id, newIsLiked);

    try {
      // Call API
      await toggleLike(message.id, newIsLiked);
      // Don't update state again here to prevent double-counting
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic update on error
      setIsLiked(!newIsLiked);
      setLikeCount(likeCount);
      setMessageLiked(message.id, !newIsLiked);
    }
  }

  // Render Helpers
  function renderLogo() {
    if (isInternal) {
      return null;
    }

    const logoImg = (
      <Image
        src={anonGroup.logoUrl}
        alt={anonGroup.title}
        width={40}
        height={40}
      />
    );

    // Redirect to group page on logo click if not already on it
    if (!isGroupPage) {
      return (
        <Link
          href={`/${provider.getSlug()}/${message.anonGroupId}`}
          className="message-card-header-logo"
        >
          {logoImg}
        </Link>
      );
    }

    return <div className="message-card-header-logo">{logoImg}</div>;
  }

  function renderSender() {
    const timestampComponent = (
      <span
        className="message-card-header-timestamp"
        title={message.timestamp.toLocaleString()}
      >
        {timeAgo.format(new Date(message.timestamp))}
      </span>
    );

    if (isInternal) {
      return (
        <div className="message-card-header-sender-name internal">
          <span>{generateNameFromPubkey(message.ephemeralPubkey.toString())}</span>
          {timestampComponent}
        </div>
      );
    }

    return (
      <span>
        <div className="message-card-header-sender-text">
          <span>Someone from</span>
        </div>
        <div className="message-card-header-sender-name">
          {isGroupPage ? (
            <span>{anonGroup.title}</span>
          ) : (
            <Link href={`/domain/${message.anonGroupId}`}>{anonGroup.title}</Link>
          )}

          {isMessagePage ? (
            timestampComponent
          ) : (
            <Link href={`/messages/${message.id}`}>{timestampComponent}</Link>
          )}
        </div>
      </span>
    );
  }

  // Verification functionality has been removed

  // Render
  return (
    <div className="message-card">
      <header className="message-card-header">
        <div className="message-card-header-sender">
          {renderLogo()}
          {renderSender()}
        </div>
      </header>

      <main className="message-card-content">{message.text}</main>

      <div className="message-card-footer">
        <div className="like-button-container">
          <button
            onClick={onLikeClick}
            disabled={!hasAuth}
            className={`like-button ${isLiked ? "liked" : ""}`}
            title={!hasAuth ? "Sign in to like messages" : isLiked ? "Unlike this message" : "Like this message"}
          >
            <IonIcon name={isLiked ? "heart" : "heart-outline"} />
            <span className="like-count">{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageCard;
