# 🆘 FIX: Support Questions Workflow Update

## PROBLÈME

Quand l'utilisateur clique sur "Retours" ou pose une question sur la politique de retour :
- ❌ **Réponse actuelle** : "Nous n'avons actuellement aucun produit disponible, donc je ne peux pas vous fournir d'informations sur notre politique de retour"
- ✅ **Réponse attendue** : Informations sur la politique de retour du magasin

**CAUSE** : Le system prompt N8N dit "NO PRODUCTS CURRENTLY AVAILABLE" quand `products.length === 0`, et l'IA pense qu'elle ne peut rien répondre.

**La politique de retour n'a RIEN À VOIR avec l'inventaire de produits !**

---

## SOLUTION

### 1. Backend fetch maintenant les VRAIES politiques du magasin depuis Shopify

Le backend récupère maintenant les politiques directement depuis **Shopify Admin GraphQL** :

```graphql
query getShopPolicies {
  shop {
    name
    refundPolicy { body }
    shippingPolicy { body }
    privacyPolicy { body }
  }
}
```

Le contexte N8N contient maintenant les **VRAIES politiques du shop** :
```javascript
context: {
  intentType: "customer_support",
  supportCategory: "RETURNS" | "SHIPPING_INFO" | "TRACK_ORDER",
  storePolicies: {
    shopName: "Nom de la boutique",
    returns: "<VRAIE politique de retour depuis Shopify>",
    shipping: "<VRAIE politique de livraison depuis Shopify>",
    privacy: "<VRAIE politique de confidentialité depuis Shopify>"
  }
}
```

✅ **Chaque boutique aura SES propres politiques**
⚠️ **Si une politique n'est pas configurée dans Shopify**, un message par défaut traduit sera utilisé

### 2. Modifier le System Prompt dans N8N

**ANCIEN SYSTEM PROMPT** (ligne 11 du workflow) :
```javascript
($('Webhook').item.json.body.products && $('Webhook').item.json.body.products.length > 0 
  ? '📦 AVAILABLE PRODUCTS ...' 
  : '⚠️ NO PRODUCTS CURRENTLY AVAILABLE in inventory.')
```

**NOUVEAU SYSTEM PROMPT** :
```javascript
// Vérifier si c'est une question support
{{ 
  $('Webhook').item.json.body.context.intentType === 'customer_support' 
  ? 
    // 🆘 SUPPORT QUESTION - Use store policies, NOT inventory
    '🆘 CUSTOMER SUPPORT MODE for ' + ($('Webhook').item.json.body.context.storePolicies?.shopName || 'this shop') + '\n\n' +
    'You are answering a SUPPORT question. DO NOT mention product inventory.\n\n' +
    '📋 REAL SHOP POLICIES (fetched from Shopify):\n\n' +
    '🔄 RETURN POLICY:\n' + ($('Webhook').item.json.body.context.storePolicies?.returns || 'Return policy not configured in Shopify') + '\n\n' +
    '📦 SHIPPING POLICY:\n' + ($('Webhook').item.json.body.context.storePolicies?.shipping || 'Shipping policy not configured in Shopify') + '\n\n' +
    'Question type: ' + $('Webhook').item.json.body.context.supportCategory + '\n\n' +
    'Use the REAL policies above to answer. Be helpful and concise.'
  :
    // 📦 PRODUCT QUESTION - Show inventory
    ($('Webhook').item.json.body.products && $('Webhook').item.json.body.products.length > 0 
      ? '📦 AVAILABLE PRODUCTS:\n' + $('Webhook').item.json.body.products.map((p, i) => (i + 1) + '. ' + p.title + ' - $' + p.price).join('\n') + '\n\n'
      : '⚠️ NO PRODUCTS AVAILABLE for this query.\n\n'
    )
}}

// Reste du prompt...
'📋 YOUR ROLE:\n' +
'- Help customers with their questions\n' +
'- For SUPPORT questions: Use the store policies provided above\n' +
'- For PRODUCT questions: Only mention products from the available list\n' +
'- Be friendly, helpful, and concise\n\n' +
'🌍 LANGUAGE: Respond in ' + 
  ($('Webhook').item.json.body.context.locale === 'fr' ? 'French' : 
   $('Webhook').item.json.body.context.locale === 'es' ? 'Spanish' : 
   $('Webhook').item.json.body.context.locale === 'de' ? 'German' : 'English')
```

---

## WORKFLOW JSON UPDATE

Remplacer la section **"systemPrompt"** (id: 11) dans le noeud **"Prepare Data"** :

```json
{
  "id": "11",
  "name": "systemPrompt",
  "value": "={{ $('Webhook').item.json.body.context.intentType === 'customer_support' ? '🆘 CUSTOMER SUPPORT MODE\\n\\nYou are answering a SUPPORT question. DO NOT mention product inventory or say \"no products available\". Support questions are about store POLICIES, not products.\\n\\n📋 STORE POLICIES:\\n• Returns: ' + ($('Webhook').item.json.body.context.storePolicies?.returns || 'Returns within 30 days of purchase. Contact customer service for details.') + '\\n• Shipping: ' + ($('Webhook').item.json.body.context.storePolicies?.shipping || 'Free shipping on orders over $50. Delivery times vary by location.') + '\\n• Track Order: ' + ($('Webhook').item.json.body.context.storePolicies?.trackOrder || 'Check your email for tracking information once your order ships.') + '\\n\\nQuestion type: ' + $('Webhook').item.json.body.context.supportCategory + '\\n\\nProvide a helpful answer using the policies above.' : 'You are ' + ($('Get Shop Settings').item.json.chatTitle || 'an AI shopping assistant') + ' for ' + $('Webhook').item.json.body.context.shopDomain + '.\\n\\n🎯 PRIMARY RULE: ONLY mention products that exist in the AVAILABLE PRODUCTS list below.\\n\\n' + ($('Webhook').item.json.body.products && $('Webhook').item.json.body.products.length > 0 ? '📦 AVAILABLE PRODUCTS:\\n' + $('Webhook').item.json.body.products.map((p, i) => (i + 1) + '. ' + p.title + ' - $' + p.price + (p.description ? ' - ' + p.description.substring(0, 50) : '')).join('\\n') + '\\n\\nTotal products: ' + $('Webhook').item.json.body.products.length : '⚠️ NO PRODUCTS for this query.') + '\\n\\n📋 YOUR ROLE:\\n- Help customers find products\\n- Answer questions about pricing, shipping, product features\\n- Be friendly and concise' }} + '\\n\\n🌍 LANGUAGE: Respond in ' + ($('Webhook').item.json.body.context.locale === 'fr' ? 'French' : $('Webhook').item.json.body.context.locale === 'es' ? 'Spanish' : $('Webhook').item.json.body.context.locale === 'de' ? 'German' : $('Webhook').item.json.body.context.locale === 'pt' ? 'Portuguese' : $('Webhook').item.json.body.context.locale === 'it' ? 'Italian' : 'English') }}",
  "type": "string"
}
```

---

## RÉSULTAT ATTENDU

**Avant** :
- Clic "Retours" → "Nous n'avons actuellement aucun produit disponible..."

**Après** :
- Clic "Retours" → "Notre politique de retour permet les retours dans les 30 jours suivant l'achat. Contactez notre service client pour plus de détails."

---

## FICHIERS MODIFIÉS

- `app/routes/api.widget-settings.tsx` : Ajoute `storePolicies` au contexte pour les support intents
- Workflow N8N : Modifier le system prompt pour vérifier `intentType === 'customer_support'`

---

## INSTRUCTIONS POUR L'UTILISATEUR

1. **Ouvrir votre workflow N8N**
2. **Trouver le noeud "Prepare Data"**
3. **Remplacer le champ "systemPrompt"** avec le nouveau code ci-dessus
4. **Sauvegarder et activer le workflow**
5. **Tester** en cliquant sur "Retours" dans le widget

