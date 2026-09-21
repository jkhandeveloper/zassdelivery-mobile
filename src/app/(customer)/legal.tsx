import { useRouter } from "expo-router";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
import * as React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

/**
 * Terms, privacy and refunds.
 *
 * ⚠️ **The prose below is a plain-language summary of what this app actually
 * does — not a legal document, and not a substitute for one.** It was written
 * from the codebase (what data the app collects, when it collects location,
 * who takes payment) so that it is at least *accurate*, which the web app's
 * "Legal copy pending" placeholders are not.
 *
 * Before store submission you still need real policies, reviewed by someone
 * qualified, hosted at a public URL. Both stores require a reachable privacy
 * policy link and will reject the build without one — Apple in App Store
 * Connect, Google in the Play Console Data Safety form. Point `LEGAL_LINKS`
 * at them once they exist.
 *
 * The one section that is more than boilerplate is refunds: on this platform
 * the vendor takes the customer's money directly and the platform never holds
 * it, so a refund is the restaurant's to give. Getting that wrong in writing
 * would set an expectation the system cannot meet.
 */

const LEGAL_LINKS: readonly { label: string; url: string }[] = [
  { label: "Terms of service", url: "https://zassdeliver.com/terms" },
  { label: "Privacy policy", url: "https://zassdeliver.com/privacy" },
  { label: "Refund policy", url: "https://zassdeliver.com/refunds" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2">
      <Heading level={3}>{title}</Heading>
      {children}
    </Card>
  );
}

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const open = React.useCallback((url: string) => {
    void Linking.openURL(url).catch(() =>
      toast.error("Couldn't open that link", { description: url }),
    );
  }, []);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Legal</Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8">
        <Body muted className="text-[13px]">
          A plain-language summary of how ZassDelivery works. The full policies are linked at the
          bottom and are what apply.
        </Body>

        <Section title="How payment works">
          <Body muted className="text-[14px]">
            You pay the restaurant, not us. Depending on what the restaurant offers, that is
            cash to the rider at your door, or a transfer you make by scanning the
            restaurant&apos;s own QR code. ZassDelivery never holds your money and never takes a
            cut of your order.
          </Body>
          <Body muted className="text-[14px]">
            We charge restaurants a monthly subscription to be listed. That is the whole of our
            relationship with the money.
          </Body>
        </Section>

        <Section title="Refunds and problems with an order">
          <Body muted className="text-[14px]">
            Because the restaurant took the payment, a refund is theirs to give. If something is
            wrong — missing items, cold food, an order that never arrived — open a support
            ticket in the app. We will take it up with the restaurant on your behalf and press
            them for a resolution, but we cannot reverse a payment we never received.
          </Body>
          <Body muted className="text-[14px]">
            You can cancel an order yourself while the restaurant has not yet started cooking.
            After that, cancellation is at their discretion.
          </Body>
        </Section>

        <Section title="What we collect">
          <Body muted className="text-[14px]">
            Your phone number, name, and optionally an email — the phone number is how you sign
            in. Your saved delivery addresses, including their map coordinates, because delivery
            fees and whether we can reach you at all are worked out from them. Your order
            history. Photos you choose to upload, such as a profile picture.
          </Body>
        </Section>

        <Section title="Location">
          <Body muted className="text-[14px]">
            We ask for your location only when you tap to use it — to pin a new address, or to
            sort restaurants by distance. We do not track you in the background.
          </Body>
          <Body muted className="text-[14px]">
            Riders are different, and they are told so separately: while a rider is carrying
            your order, their phone reports its position so you can watch the delivery on a map.
            That reporting stops the moment the delivery ends.
          </Body>
        </Section>

        <Section title="Notifications">
          <Body muted className="text-[14px]">
            We send you notifications about your own orders — confirmed, being cooked, on the
            way, delivered. You can turn these off in your phone&apos;s settings, though you
            will then have to open the app to see where your order is.
          </Body>
        </Section>

        <Card className="gap-1">
          <Heading level={3}>The full policies</Heading>
          <Body muted className="text-[13px]">
            These open in your browser.
          </Body>

          <View className="mt-1">
            {LEGAL_LINKS.map((link, index) => (
              <View key={link.url}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${link.label}, opens in your browser`}
                  onPress={() => open(link.url)}
                  className="flex-row items-center gap-3 py-3"
                >
                  <Text className="flex-1 font-sans text-[15px] text-brand">{link.label}</Text>
                  <ExternalLink size={16} color="#0E7490" />
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
