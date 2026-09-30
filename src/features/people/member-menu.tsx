import { useRouter } from "expo-router";
import { Ban, Flag } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  Button,
  colors,
  ListGroup,
  ListRow,
  radius,
  Separator,
  space,
  Text,
} from "@/ui";
import { useBlockMember } from "./api";
import { StatusLine, useFailureText } from "./follow-button";
import { Sheet } from "./sheet";

/**
 * 「その他の操作」 on a profile (src/components/follows/member-menu.tsx):
 * report to the committee (お問い合わせ → 会員の言動について), and block,
 * after a confirmation. Blocking leaves the (now hidden) profile
 * for the blocked list, as the website does.
 */
export function MemberMenu({
  visible,
  onClose,
  memberId,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  name: string;
}) {
  const t = useTranslations("follows");
  const failure = useFailureText();
  const router = useRouter();
  const block = useBlockMember(memberId);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    block.reset();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={t("menu.label")}>
      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {t("actions.blockConfirm", { name })}
          </Text>
          <Button
            variant="danger"
            label={
              block.isPending ? t("actions.working") : t("actions.blockYes")
            }
            loading={block.isPending}
            onPress={() =>
              block.mutate(true, {
                onSuccess: () => {
                  close();
                  router.replace({
                    pathname: "/follows",
                    params: { tab: "blocked" },
                  });
                },
              })
            }
          />
          <Button
            variant="secondary"
            label={t("actions.cancel")}
            disabled={block.isPending}
            onPress={() => setConfirming(false)}
          />
          <StatusLine text={block.error ? failure(block.error) : null} />
        </View>
      ) : (
        <ListGroup>
          <ListRow
            title={t("actions.report")}
            leading={<Flag size={20} color={colors.slate600} aria-hidden />}
            onPress={() => {
              close();
              router.push("/support?type=COMPLAINT&topic=MEMBER_CONDUCT");
            }}
          />
          <Separator />
          <ListRow
            title={t("actions.block")}
            destructive
            chevron={false}
            leading={<Ban size={20} color={colors.red700} aria-hidden />}
            onPress={() => setConfirming(true)}
          />
        </ListGroup>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  confirm: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red100,
    backgroundColor: colors.red50,
  },
  confirmText: { color: colors.red700, marginBottom: space.xs },
});
