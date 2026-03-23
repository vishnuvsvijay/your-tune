import { useEffect, useState } from 'react'
import api from '../services/api'
import Navbar from '../components/Navbar'
import { useAuth } from '../store/auth'

function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.get('/auth/me').then((res) => setProfile(res.data.user)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-32">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-semibold">Profile</h2>
        <div className="mt-4 bg-neutral-800 p-4 rounded">
          <div>Name: {profile?.name || user?.name}</div>
          <div>Email: {profile?.email || user?.email}</div>
          <div>Role: {profile?.role || user?.role}</div>
        </div>
      </div>
    </div>
  )
}

export default Profile
