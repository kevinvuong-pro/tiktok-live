function firstValue(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

function firstObject(...values) {
  return values.find(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  );
}

function pickUser(data) {
  const source = firstObject(
    data.user,
    data.userInfo,
    data.author,
    data.sender,
    data.common?.user,
    data.common?.userInfo,
  );

  if (!source) return undefined;

  const user = {
    uniqueId: firstValue(source.uniqueId, source.unique_id, source.uid),
    nickname: firstValue(source.nickname, source.nickName, source.displayName),
    displayId: firstValue(source.displayId, source.display_id),
    userId: firstValue(source.userId, source.user_id, source.id),
    avatar: firstValue(
      source.avatarThumb,
      source.avatarMedium,
      source.avatarLarger,
      source.avatar,
    ),
  };

  return Object.fromEntries(
    Object.entries(user).filter(([, value]) => value !== undefined),
  );
}

function pickRoom(data) {
  const room = {
    roomId: firstValue(data.roomId, data.room_id, data.common?.roomId),
    viewerCount: firstValue(
      data.viewerCount,
      data.userCount,
      data.user_count,
      data.viewer_count,
    ),
  };

  return Object.fromEntries(
    Object.entries(room).filter(([, value]) => value !== undefined),
  );
}

export function selectEventData(type, input) {
  const data = input && typeof input === "object" ? input : {};
  const selected = {
    user: pickUser(data),
    comment: firstValue(data.comment, data.content, data.text),
    giftId: firstValue(data.giftId, data.gift_id),
    giftName: firstValue(
      data.giftName,
      data.gift_name,
      data.giftDetails?.giftName,
      data.giftDetails?.name,
      data.gift?.name,
    ),
    repeatCount: firstValue(data.repeatCount, data.repeat_count),
    diamondCount: firstValue(data.diamondCount, data.diamond_count),
    likeCount: firstValue(data.likeCount, data.like_count),
    totalLikeCount: firstValue(data.totalLikeCount, data.total_like_count),
    memberCount: firstValue(data.memberCount, data.member_count),
    action: firstValue(data.displayType, data.label, data.action),
    question: firstValue(
      data.question,
      data.questionDetails?.content,
    ),
    room: pickRoom(data),
  };

  const normalizedType = String(type).toLowerCase();
  if (normalizedType === "chat" && selected.comment === undefined) {
    selected.comment = firstValue(data.common?.displayText?.defaultPattern);
  }

  return Object.fromEntries(
    Object.entries(selected).filter(([, value]) => {
      if (value === undefined) return false;
      return !(typeof value === "object" && Object.keys(value).length === 0);
    }),
  );
}
