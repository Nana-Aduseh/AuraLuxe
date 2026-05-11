'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/currency'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getCart, createOrder, CartItem } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [useSavedAddress, setUseSavedAddress] = useState(false)
  const [savedAddress, setSavedAddress] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  // Form states
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [town, setTown] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')

  // Payment form states
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCVC, setCardCVC] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)
      setEmail(user.email || '')

      // Load saved address
      const { data: address } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (address) {
        setSavedAddress(address)
        setUseSavedAddress(true)
        setFirstName(address.first_name)
        setLastName(address.last_name)
        setEmail(address.email)
        setAddress(address.address)
        setTown(address.town)
        setRegion(address.region)
        setPhone(address.phone || '')
      }

      const cart = await getCart(user.id)
      setCartItems(cart)

      if (cart.length === 0) {
        router.push('/cart')
        return
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const total = cartItems.reduce((sum, item) => {
    const product = item.product || {}
    return sum + ((product.price || 0) * (item.quantity_ordered || 1))
  }, 0)

  const handleUseSavedAddress = () => {
    if (!useSavedAddress && savedAddress) {
      setFirstName(savedAddress.first_name)
      setLastName(savedAddress.last_name)
      setEmail(savedAddress.email)
      setAddress(savedAddress.address)
      setTown(savedAddress.town)
      setRegion(savedAddress.region)
      setPhone(savedAddress.phone || '')
    }
  }

  const handleSubmitShipping = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName || !address || !town || !region) {
      alert('Please fill in all required fields')
      return
    }

    // Save address for future use
    if (user && !useSavedAddress) {
      await supabase.from('user_addresses').upsert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        address: address,
        town: town,
        region: region,
        phone: phone,
      })
    }

    setShowPayment(true)
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cardName || !cardNumber || !cardExpiry || !cardCVC) {
      alert('Please fill in all payment details')
      return
    }

    setProcessing(true)

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Create order
      if (user) {
        const order = await createOrder(user.id, cartItems, total)

        if (order) {
          router.push(`/order-confirmation/${order.id}`)
        }
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </main>
    )
  }

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">Cart is empty</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping Form */}
            {!showPayment && (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Delivery Information
                </h2>

                {/* Use Saved Address Option */}
                {savedAddress && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSavedAddress}
                        onChange={(e) => {
                          setUseSavedAddress(e.target.checked)
                          if (e.target.checked) {
                            handleUseSavedAddress()
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Use my saved delivery address
                      </span>
                    </label>
                    {useSavedAddress && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p>{savedAddress.first_name} {savedAddress.last_name}</p>
                        <p>{savedAddress.address}</p>
                        <p>{savedAddress.town}, {savedAddress.region}</p>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmitShipping} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input value={email} disabled className="bg-gray-100" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address *
                    </label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Town *
                      </label>
                      <Input
                        value={town}
                        onChange={(e) => setTown(e.target.value)}
                        placeholder="Town/City"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Region *
                      </label>
                      <Input
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="State/Region"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3"
                  >
                    Continue to Payment
                  </Button>
                </form>
              </div>
            )}

            {/* Payment Form */}
            {showPayment && (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="mb-6">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="text-amber-600 hover:text-amber-700 text-sm"
                  >
                    ← Back to Shipping
                  </button>
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Payment Information
                </h2>

                {/* Fake Paystack Logo */}
                <div className="mb-8 p-4 bg-white rounded border border-gray-200">
                  <div className="text-center mb-4">
                    <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded font-bold">
                      PAYSTACK
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    Secure Payment Gateway
                  </p>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name
                    </label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <Input
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <Input
                        value={cardCVC}
                        onChange={(e) => setCardCVC(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-6">
                    <p className="text-sm text-blue-700">
                      💡 This is a demo. Use any card details to proceed.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    {processing ? 'Processing Payment...' : 'Complete Payment'}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                {cartItems.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">
                        {item.product?.name} x{item.quantity_ordered}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {formatPrice(
                          (item.product?.price || 0) * item.quantity_ordered
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.color?.color_name} • {item.quantity?.length_inches}
                      {'"'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-amber-600">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
